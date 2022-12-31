extern crate ffmpeg_next as ffmpeg;

use base64::encode;
use log::{info, error};
use opencv::core::{Point, VecN, Size, BORDER_DEFAULT, Vector, KeyPoint, no_array, Ptr};
use opencv::features2d::{SimpleBlobDetector, SimpleBlobDetector_Params};
use opencv::imgproc::{cvt_color, circle, LINE_8, FILLED, resize, INTER_LINEAR, gaussian_blur};
use opencv::prelude::*;
use tauri::Window;
use std::sync::mpsc::Receiver;
use std::time::Instant;

use crate::camera::camera_stream;
use crate::mic::mic_stream;

fn detect_circles(frame: &Mat, detector: &mut Ptr<SimpleBlobDetector>) -> Vector<KeyPoint> {
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

pub fn display_volume(
    label: String,
    window: Window,
    rx: Receiver<()>
) {
    let grab_frame = |volume: f64, window: &Window| {
        info!("Received audio frame: {:}", volume);

        window
            .emit("grab_mic_frame", volume)
            .unwrap();
    };

    match mic_stream(label, window, rx, grab_frame) {
        Ok(()) => (),
        Err(e) => {
            error!("Could not read frames from mic ({:})", e.to_string());
            // emit toast error event with error "Could not read frames from camera"
            ()
        }
    }
}

pub fn display_camera_feed(
    label: String,
    width: u32,
    height: u32,
    min_thresh: u32,
    max_thresh: u32,
    window: Window,
    rx: Receiver<()>,
    rx_threshs: Receiver<(u32, u32)>,
) {
    struct FrameState {
        frame_index: u32,
        width: u32,
        height: u32,
        window: Window,
        rx_threshs: Receiver<(u32, u32)>,
        start_time: Instant,
        prev_frame_time: Instant,
        params: SimpleBlobDetector_Params,
        detector: Ptr<SimpleBlobDetector>
    }

    let frame_index = 0;
    let start_time = Instant::now();
    let prev_frame_time = Instant::now();
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
    let detector = SimpleBlobDetector::create(params).unwrap();
    let frame_state = FrameState{ frame_index, width, height, window, rx_threshs, start_time, prev_frame_time, params, detector };
    let grab_frame = |mat: Mat, frame_state: &mut FrameState| {
        if frame_state.frame_index == 0 {
            info!("Reading frames. Input: {:} x {:}. Output: {:} x {:}", mat.cols(), mat.rows(), frame_state.width, frame_state.height);
        } else if frame_state.prev_frame_time.elapsed().as_secs_f64() < 0.03 {
            // only process at 30fps for output to UI
            return
        }

        frame_state.prev_frame_time = Instant::now();
        
        // check if threshs have changed
        loop {
            match frame_state.rx_threshs.try_recv() {
                Ok((min_thresh, max_thresh)) => {
                    frame_state.params.min_threshold = min_thresh as f32;
                    frame_state.params.max_threshold = max_thresh as f32;
                    frame_state.detector = SimpleBlobDetector::create(frame_state.params).unwrap();
                },
                Err(_) => {
                    break;
                }
            }
        }

        // image processing pipeline
        let frame = mat.clone();

        // 1. resize frame
        let mut resized = Mat::default();
        resize(&frame, &mut resized, Size{width: frame_state.width as i32, height: frame_state.height as i32}, 0.0, 0.0, INTER_LINEAR);

        // 2. detect circles
        let keypoints = detect_circles(&resized, &mut frame_state.detector);

        // 3. draw detected circles 
        let color = VecN([255.0, 0.0, 0.0, 0.0]);
        for keypoint in keypoints {
            let center = Point{x: keypoint.pt.x as i32, y: keypoint.pt.y as i32};
            let radius = (keypoint.size / 2.0) as i32;
            circle(&mut resized, center, radius, color, FILLED, LINE_8, 0);
        } 

        // 4. convert RGB to RGBA for displaying to canvas
        let mut output = Mat::default();
        cvt_color(&resized, &mut output, opencv::imgproc::COLOR_RGB2RGBA, 0);
        let data = match output.data_bytes() {
            Ok(res) => res,
            Err(error) => {
                error!("Could not get data bytes from Mat ({:})", error);
                return;
            }
        };

        frame_state.window
            .emit("grab_camera_frame", encode(data))
            .unwrap();
        
        frame_state.frame_index += 1;
    };

    match camera_stream(label, rx, frame_state, grab_frame) {
        Ok(()) => (),
        Err(e) => {
            error!("Could not read frames from camera ({:})", e.to_string());
            // emit toast error event with error "Could not read frames from camera"
            ()
        }
    }
}