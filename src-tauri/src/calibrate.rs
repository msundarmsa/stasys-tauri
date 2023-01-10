extern crate ffmpeg_next as ffmpeg;

use log::{error, info};
use opencv::core::Ptr;
use opencv::features2d::SimpleBlobDetector;
use opencv::prelude::*;
use serde::Serialize;
use tauri::Window;
use std::sync::mpsc::Receiver;
use std::time::Instant;

use crate::camera::camera_stream;
use crate::shoot::{detect_circles, get_circle_detector, TracePoint};

// analyse trace to get calibration circle
fn calibrate(before_trace: &Vec<TracePoint>) -> Option<TracePoint> {
    let mut calibrate_point = None;
    let mut best_mean_dist = -1.0;
    let mut points:Vec<TracePoint> = Vec::new();

    for curr_tp_iter in before_trace.iter().rev() {
        let curr_tp = *curr_tp_iter;
        if points.len() == 0 {
            points.push(curr_tp);
        } else {
            let duration = points.first().unwrap().time - curr_tp.time;
            if duration > 1.0 && duration < 1.1 {
                // there has been 1s worth of data

                // calculate average position and radius of detected circle in points
                let mut avg_circle = TracePoint{ x: 0.0, y: 0.0, time: 0.0 };
                let n_points = points.len() as f64;
                for point in points.iter() {
                    avg_circle.x += point.x / n_points;
                    avg_circle.y += point.y / n_points;
                }

                // calculate mean distance from points to average position
                let mut mean_dist = 0.0;
                for point in points.iter() {
                    let del_x = point.x - avg_circle.x;
                    let del_y = point.y - avg_circle.y;
                    let dist = (del_x * del_x + del_y * del_y).sqrt();
                    mean_dist += dist / n_points;
                }

                if best_mean_dist == -1.0 || mean_dist < best_mean_dist {
                    best_mean_dist = mean_dist;
                    calibrate_point = Some(avg_circle);
                }

                points = Vec::new();
            } else {
                points.push(curr_tp);
            }
        }
    }

    return calibrate_point;
}

pub fn grab_calib_frames(
    label: String,
    min_thresh: u32,
    max_thresh: u32,
    trigger_rx: Receiver<Instant>,
    window: Window,
    rx: Receiver<()>,
) {
    // define and initialize frame state
    struct FrameState {
        frame_index: u32,
        shot_start_time: Instant,
        before_trace: Vec<TracePoint>,
        trigger_time: Option<Instant>,
        detector: Ptr<SimpleBlobDetector>,
        trigger_rx: Receiver<Instant>
    }

    let frame_index = 0;
    let detector = get_circle_detector(min_thresh, max_thresh);
    let now = Instant::now();
    let frame_state = FrameState { 
        frame_index,
        shot_start_time: now,
        before_trace: Vec::new(),
        trigger_time: None,
        detector,
        trigger_rx
    };

    let grab_frame = |frame: Mat, frame_state: &mut FrameState, window: &Window| -> bool {
        #[derive(Serialize, Clone)]
        struct CalibFinishedPayload {
            success: bool,
            calibrate_point: [f64; 2],
            error_msg: String
        }

        let curr_time = Instant::now();
        let time_since_shot_start = match frame_state.frame_index {
            0 => 0.0,
            _ => curr_time.duration_since(frame_state.shot_start_time).as_secs_f64()
        };

        match frame_state.trigger_rx.try_recv() {
            Ok(trigger_time) => {
                info!("Received trigger");
                frame_state.trigger_time = Some(trigger_time);
            }
            Err(_) => {}
        }
        let trigger_time = frame_state.trigger_time;
        frame_state.trigger_time = None;

        let keypoints = detect_circles(&frame, &mut frame_state.detector);
        let detected_circle = keypoints.len() == 1;

        if !detected_circle {
            // circle not detected properly for 1min
            if curr_time.duration_since(frame_state.shot_start_time).as_secs_f64() >= 60.0 {
                info!("Calibration failed: undetected circle");
                window
                    .emit("calibration_finished", CalibFinishedPayload{
                        success: false,
                        calibrate_point: [0.0, 0.0],
                        error_msg: "Target was not detected for 1min".to_string()
                    })
                    .unwrap();
                return false; // stop grabbing frames
            }

            return true; // continue to next frame
        }
        let circle = keypoints.get(0).unwrap();
        info!("Detected circle (px): {:}, {:}", circle.pt.x, circle.pt.y);

        if curr_time.duration_since(frame_state.shot_start_time).as_secs_f64() >= 120.0 {
            // timeout
            info!("Calibration failed: timeout");
            window
                .emit("calibration_finished", CalibFinishedPayload{
                    success: false,
                    calibrate_point: [0.0, 0.0],
                    error_msg: "Calibrating for more than 2min - timeout".to_string()
                })
                .unwrap();
            return false; // stop grabbing frames
        }

        frame_state.before_trace.push(TracePoint{
            x: circle.pt.x as f64,
            y: circle.pt.y as f64,
            time: time_since_shot_start,
        });

        if trigger_time.is_some() {
            // received trigger
            let calibrate_point = calibrate(&frame_state.before_trace);
            if calibrate_point.is_some() {
                info!("Calibration success!");
                window
                    .emit("calibration_finished", CalibFinishedPayload{
                        success: true,
                        calibrate_point: [calibrate_point.unwrap().x, calibrate_point.unwrap().y],
                        error_msg: "".to_string()
                    })
                    .unwrap();
            } else {
                info!("Calibration failed: too quick");
                window
                    .emit("calibration_finished", CalibFinishedPayload{
                        success: false,
                        calibrate_point: [0.0, 0.0],
                        error_msg: "Shot too quickly".to_string()
                    })
                    .unwrap();
            }

            return false; // stop grabbing frames
        }
        
        frame_state.frame_index += 1;
        return true; // continue onto next frame
    };

    match camera_stream(label, rx, frame_state, grab_frame, window) {
        Ok(()) => (),
        Err(e) => {
            error!("Could not read frames from camera ({:})", e.to_string());
            // emit toast error event with error "Could not read frames from camera"
            ()
        }
    }
}
