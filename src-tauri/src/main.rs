#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

extern crate ffmpeg_next as ffmpeg;
use ffmpeg::util::frame::video::Video;

use env_logger::Env;
use log::{info, error};
use opencv::core::{Point, VecN};
use opencv::imgproc::{cvt_color, circle, LINE_8, FILLED};
use opencv::prelude::*;
use tauri::{Window, State};
use std::sync::Mutex;
use std::sync::mpsc::{Receiver, channel};
use std::thread::spawn;
use base64::encode;

mod thread;
mod camera;
mod mic;
use thread::Thread;
use camera::camera_stream;
use mic::mic_stream;

struct ManagedAppState(Mutex<AppState>);
#[derive(Default)]
struct AppState {
    camera_thread: Option<Thread<()>>,
    mic_thread: Option<Thread<()>>
}

fn grab_camera_frames(
    label: String,
    width: u32,
    height: u32,
    window: Window,
    rx: Receiver<()>
) {
    let grab_frame = |mat: Mat, window: &Window| {
        let mut matcircle = mat.clone();
        let mut output = mat.clone();
        circle(&mut matcircle, Point{x: 150, y: 160}, 20, VecN([255.0, 0.0, 0.0, 0.0]), FILLED, LINE_8, 0);
        cvt_color(&matcircle, &mut output, opencv::imgproc::COLOR_RGB2RGBA, 0);
        let data = match output.data_bytes() {
            Ok(res) => res,
            Err(error) => {
                error!("Could not get data bytes from Mat ({:})", error);
                return;
            }
        };

        window
            .emit("grab_camera_frame", encode(data))
            .unwrap(); 
    };

    match camera_stream(label, width, height, window, rx, grab_frame) {
        Ok(()) => (),
        Err(e) => {
            error!("Could not read frames from camera ({:})", e.to_string());
            // emit toast error event with error "Could not read frames from camera"
            ()
        }
    }
}

#[tauri::command]
fn settings_choose_camera(
    label: String,
    width: u32,
    height: u32,
    window: Window,
    state: State<ManagedAppState>,
) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();

    // start thread to grab camera
    let (tx, rx) = channel();
    let handle = spawn(move || grab_camera_frames(label, width, height, window, rx));
    let name = "grab_camera_frame".to_string();
    curr_state.camera_thread = Some(Thread{name, handle, tx});

    // remove lock
    drop(curr_state);
}

#[tauri::command]
fn settings_close_camera(state: State<ManagedAppState>) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();
    
    if curr_state.camera_thread.is_some() {
        curr_state.camera_thread.take().unwrap().terminate();
    }

    // remove lock
    drop(curr_state);
}

fn grab_mic_frames(
    label: String,
    window: Window,
    rx: Receiver<()>
) {
    let grab_frame = |volume: f64, window: &Window| {
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

#[tauri::command]
fn settings_choose_mic(
    label: String,
    window: Window,
    state: State<ManagedAppState>,
) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();

    // start thread to grab camera
    let (tx, rx) = channel();
    let handle = spawn(move || grab_mic_frames(label, window, rx));
    let name = "grab_frame_thread".to_string();
    curr_state.mic_thread = Some(Thread{name, handle, tx});

    // remove lock
    drop(curr_state);
}

#[tauri::command]
fn settings_close_mic(state: State<ManagedAppState>) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();
    
    if curr_state.mic_thread.is_some() {
        curr_state.mic_thread.take().unwrap().terminate();
    }

    // remove lock
    drop(curr_state);
}

fn main() {
    env_logger::Builder::from_env(Env::default().default_filter_or("debug")).init();
    ffmpeg::init().unwrap();

    info!("Started backend");

    tauri::Builder::default()
        .manage(ManagedAppState(Default::default()))
        .invoke_handler(tauri::generate_handler![settings_choose_camera, settings_close_camera, settings_choose_mic, settings_close_mic])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
