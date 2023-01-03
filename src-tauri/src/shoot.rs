extern crate ffmpeg_next as ffmpeg;

use log::{error, info};
use opencv::core::{Size, BORDER_DEFAULT, Vector, KeyPoint, no_array, Ptr, Rect};
use opencv::features2d::{SimpleBlobDetector, SimpleBlobDetector_Params};
use opencv::imgproc::{cvt_color, gaussian_blur};
use opencv::prelude::*;
use serde::Serialize;
use tauri::Window;
use std::sync::mpsc::{Receiver, Sender};
use std::time::{Instant, Duration};
use cubic_splines::{Spline, BoundaryCondition};

use crate::camera::camera_stream;
use crate::mic::mic_stream;

// sizes in mm
static TARGET_SIZE: f64 = 170.0;
static RATIO1: f64 = 170.0 / 254.0;

pub fn detect_circles(frame: &Mat, detector: &mut Ptr<SimpleBlobDetector>) -> Vector<KeyPoint> {
    // if frame is not grayscale, convert it
    let mut gray_frame = Mat::default();
    if frame.channels() == 3 {
        cvt_color(&frame, &mut gray_frame, opencv::imgproc::COLOR_RGB2GRAY, 0);
    }
  
    let mut blurred_frame = Mat::default();
    gaussian_blur(&gray_frame, &mut blurred_frame, Size{width: 9, height: 9}, 0.0, 0.0, BORDER_DEFAULT);

    let mut keypoints = Vector::new();
    detector.detect(&blurred_frame, &mut keypoints, &no_array());

    return keypoints;
}

pub fn crop_frame(frame: &Mat, calibrate_point: [f64; 2]) -> Mat {
    // clip 1.75x size of card around aim center
    let mut width = ((1.75 * TARGET_SIZE) / RATIO1).floor();
    let mut height = width;
    let mut x = calibrate_point[0] - width / 2.0;
    let mut y = calibrate_point[1] - height / 2.0;
    
    // clip x, y, width, height to be within the bounds of the frame
    x = x.max(0.0);
    y = y.max(0.0);
    let frame_width = frame.cols() as f64;
    let frame_height = frame.rows() as f64;
    width = if x + width > frame_width { frame_width - x } else { width };
    height = if y + height > frame_height { frame_height - y } else { height };

    return Mat::roi(frame, Rect::new(x as i32, y as i32, width as i32, height as i32)).unwrap().clone();
}

pub fn grab_shoot_mic(
    label: String,
    threshold: f64,
    window: Window,
    trigger_tx: Option<Sender<Instant>>,
    rx: Receiver<()>
) {
    let grab_frame = |volume: f64, threshold: f64, trigger_tx: Option<&Sender<Instant>>, last_trigger: &mut Option<Instant>, _window: &Window| {
        let now = Instant::now();

        // trigger is locked for 5s after last trigger
        let trigger_locked = last_trigger.is_some() && now.duration_since(last_trigger.unwrap()).as_secs_f64() <= 5.0;

        if !trigger_locked && volume > threshold {
            trigger_tx.unwrap().send(Instant::now());
            *last_trigger = Some(now);
        }
    };

    match mic_stream(label, window, rx, threshold, trigger_tx, grab_frame) {
        Ok(()) => (),
        Err(e) => {
            error!("Could not read frames from mic ({:})", e.to_string());
            // emit toast error event with error "Could not read frames from camera"
            ()
        }
    }
}

pub fn get_circle_detector(min_thresh: u32, max_thresh: u32) -> Ptr<SimpleBlobDetector> {
    let mut params = SimpleBlobDetector_Params::default().unwrap();
    params.min_threshold = min_thresh as f32;
    params.max_threshold = max_thresh as f32;

    params.filter_by_color = false;
    params.filter_by_convexity = false;

    params.filter_by_area = true;
    params.min_area = 450.0;
    params.max_area = 10000.0;

    params.filter_by_circularity = true;
    params.min_circularity = 0.7;

    params.filter_by_inertia = true;
    params.min_inertia_ratio = 0.85;
    return SimpleBlobDetector::create(params).unwrap();
}

pub fn grab_shoot_frames(
    label: String,
    calibrate_point: [f64; 2],
    fine_adjust: [f64; 2],
    min_thresh: u32,
    max_thresh: u32,
    up_down: bool,
    trigger_rx: Receiver<Instant>,
    window: Window,
    rx: Receiver<()>,
) {
    #[derive(Serialize, Clone, Copy)]
    struct TracePoint {
        x: f64,
        y: f64,
        time: f64, // time since shot start
    }

    // define and initialize frame state
    struct FrameState {
        frame_index: u32,
        shot_start_time: Instant,
        shot_started: bool,
        circle_detected_time: Instant,
        before_trace: Vec<TracePoint>,
        shot_point: Option<TracePoint>,
        after_trace: Vec<TracePoint>,
        pre_trace: Vec<TracePoint>,
        calibrate_point: [f64; 2],
        fine_adjust: [f64; 2],
        up_down: bool,
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
        shot_started: false,
        circle_detected_time: now,
        before_trace: Vec::new(),
        shot_point: None,
        after_trace: Vec::new(),
        pre_trace: Vec::new(),
        calibrate_point,
        fine_adjust,
        up_down,
        trigger_time: None,
        detector,
        trigger_rx
    };

    let grab_frame = |frame: Mat, frame_state: &mut FrameState, window: &Window| {
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

        if frame_state.shot_started {
            // shot has started i.e. the aim has went past the top edge and came back down
            let time_since_circle_detected = curr_time.duration_since(frame_state.circle_detected_time).as_secs_f64();
            if time_since_circle_detected > 2.0 {
                // reset shot if shot has started but aim is not within the target/cannot be found
                // for 2s
                frame_state.shot_started = false;
                frame_state.before_trace = Vec::new();
                frame_state.shot_point = None;
                frame_state.after_trace = Vec::new();

                window
                    .emit("clear_trace", {})
                    .unwrap();
                // delay_read = 1000 / idle_fps;
            } else {
                if time_since_shot_start > 60.0 && frame_state.shot_point.is_none() {
                    // reset trace if shot has started but trigger has not been pulled for 60s
                    frame_state.before_trace = Vec::new();
                    frame_state.shot_point = None;
                    frame_state.after_trace = Vec::new();

                    window
                        .emit("clear_trace", {})
                        .unwrap();

                    // but update the start time to the current time
                    frame_state.shot_start_time = curr_time;
                } else if
                    frame_state.shot_point.is_some() &&
                    time_since_shot_start - frame_state.shot_point.unwrap().time >= 1.0
                {
                    // 1s after trigger is pulled, shot is finished. create new object for this shot
                    // and draw the x-t and y-t graph
                    let mut before_trace: Vec<TracePoint> = Vec::new();
                    for trace_point in &frame_state.before_trace {
                        before_trace.push(TracePoint { x: trace_point.x, y: trace_point.y, time: trace_point.time });
                    }

                    let mut after_trace: Vec<TracePoint> = Vec::new();
                    for trace_point in &frame_state.after_trace {
                        after_trace.push(TracePoint { x: trace_point.x, y: trace_point.y, time: trace_point.time });
                    }

                    #[derive(Serialize, Clone)]
                    struct Payload {
                        before_trace: Vec<TracePoint>,
                        shot_point: TracePoint,
                        after_trace: Vec<TracePoint>
                    }
                    window
                        .emit("shot_finished", Payload {
                            before_trace,
                            shot_point: frame_state.shot_point.unwrap(),
                            after_trace
                        })
                        .unwrap();

                    // reset shot
                    frame_state.shot_started = false;
                    frame_state.before_trace = Vec::new();
                    frame_state.shot_point = None;
                    frame_state.after_trace = Vec::new();

                    // delay_read = 1000 / idle_fps;
                }
            }
        }

        let cropped_frame = crop_frame(&frame, frame_state.calibrate_point);
        let keypoints = detect_circles(&cropped_frame, &mut frame_state.detector);
        let detected_circle = keypoints.len() == 1;

        if detected_circle {
            let circle = keypoints.get(0).unwrap();
            // ramp up back to 120fps
            // delay_read = 0;

            // aim i.e. black circle was found
            // flip & rotate the x, y to fit camera
            let x = (-circle.pt.y as f64 + cropped_frame.rows() as f64 / 2.0) * RATIO1 + frame_state.fine_adjust[0];
            let y = (circle.pt.x as f64 - cropped_frame.cols() as f64 / 2.0) * RATIO1 + frame_state.fine_adjust[1];
            let center = TracePoint{
                x,
                y,
                time: curr_time.duration_since(frame_state.shot_start_time).as_secs_f64(),
            };
            info!("Detected circle (px): {:}, {:}. Position (mm): {:}, {:}", circle.pt.x, circle.pt.y, center.x, center.y);

            if x >= -TARGET_SIZE / 2.0 &&
               x <= TARGET_SIZE / 2.0 &&
               y >= -TARGET_SIZE / 2.0 &&
               y <= TARGET_SIZE / 2.0
            {
                // aim is found and within the target
                frame_state.circle_detected_time = curr_time;
            }

            if !frame_state.shot_started {
                if frame_state.up_down {
                    // if up/down detection is enabled, detect aim going up and down
                    if frame_state.pre_trace.len() <= 1 {
                        frame_state.pre_trace.push(center);
                    } else {
                        frame_state.pre_trace[0] = frame_state.pre_trace[1];
                        frame_state.pre_trace[1] = center;
                    }

                    if frame_state.pre_trace.len() == 2 {
                        // shot is started if the aim went past the edge (preTrace[0].y > TARGET_SIZE / 2)
                        // and came back down after that (preTrace[1].y < TARGET_SIZE / 2)
                        frame_state.shot_started =
                            frame_state.pre_trace[0].y > TARGET_SIZE / 2.0 &&
                            frame_state.pre_trace[1].y < TARGET_SIZE / 2.0;
                    }
                } else {
                    // else shot is started from the frame the circle is detected
                    frame_state.shot_started = true;
                }

                if frame_state.shot_started {
                    // new shot started
                    // reset traces
                    frame_state.before_trace = Vec::new();
                    frame_state.shot_point = None;
                    frame_state.after_trace = Vec::new();
                    frame_state.pre_trace = Vec::new();

                    window
                        .emit("clear_trace", {})
                        .unwrap();

                    frame_state.shot_start_time = curr_time;
                } 
            } else {
                if frame_state.shot_point.is_none() {
                    if frame_state.trigger_time.is_some() {
                        // trigger has just been pulled
                        if frame_state.trigger_time.unwrap() > curr_time {
                            // trigger was after frame was taken
                            // add current position to before trace
                            frame_state.before_trace.push(center);
                            
                            window
                                .emit("add_before", center)
                                .unwrap();
                        } else {
                            // trigger was before frame was taken
                            // add current position to after trace
                            frame_state.after_trace.push(center);

                            window
                                .emit("add_after", center)
                                .unwrap();
                        }
                        frame_state.shot_point = Some(center);
                    } else {
                        frame_state.before_trace.push(center);

                        window
                            .emit("add_before", center)
                            .unwrap();
                    }
                } else {
                    if frame_state.after_trace.len() < 2 {
                        frame_state.after_trace.push(center);
                    } else if frame_state.after_trace.len() == 2 {
                        frame_state.after_trace.push(center);

                        let mut t_x = Vec::new();
                        let mut t_y = Vec::new();
                        for i in frame_state.before_trace.len() - 3..frame_state.before_trace.len() {
                            let time = frame_state.before_trace[i].time;
                            t_x.push((frame_state.before_trace[i].x, time));
                            t_y.push((frame_state.before_trace[i].y, time));
                        }

                        for i in 0..3 {
                            let time = frame_state.after_trace[i].time;
                            t_x.push((frame_state.after_trace[i].x, time));
                            t_y.push((frame_state.after_trace[i].y, time));
                        }

                        let sx = Spline::new(t_x, BoundaryCondition::Natural);
                        let sy = Spline::new(t_y, BoundaryCondition::Natural);

                        let trigger_time_from_shot_start = frame_state.trigger_time.unwrap().duration_since(frame_state.shot_start_time).as_secs_f64();
                        let interp_x = sx.eval(trigger_time_from_shot_start);
                        let interp_y = sy.eval(trigger_time_from_shot_start);

                        let shot_point = TracePoint {
                            x: interp_x,
                            y: interp_y,
                            time: trigger_time_from_shot_start,
                        };
                        frame_state.shot_point = Some(shot_point);

                        window
                            .emit("add_before", shot_point)
                            .unwrap();
                        window
                            .emit("add_after", shot_point)
                            .unwrap();
                        window
                            .emit("add_shot", shot_point)
                            .unwrap();

                        frame_state.trigger_time = None;
                    } else {
                        frame_state.after_trace.push(center);
                        window
                            .emit("add_after", center)
                            .unwrap();
                    }
                }
            }
        }

        if !frame_state.shot_started {
            // eitherways reset triggered value
            // if shot has not been started
            frame_state.trigger_time = None;
        }
        
        frame_state.frame_index += 1;
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
