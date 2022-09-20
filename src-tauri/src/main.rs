#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

extern crate ffmpeg_next as ffmpeg;
use ffmpeg::util::frame::video::Video;

use env_logger::Env;
use log::{info, error};
use tauri::{Window, State};
use std::sync::Mutex;
use std::sync::mpsc::{Receiver, channel};
use std::thread::spawn;
use base64::encode;

mod thread;
mod camera;
use thread::Thread;
use camera::camera_stream;

struct ManagedAppState(Mutex<AppState>);
#[derive(Default)]
struct AppState {
    camera_thread: Option<Thread<()>>
}

fn grab_frame_thread(
    label: String,
    width: u32,
    height: u32,
    window: Window,
    rx: Receiver<()>
) {
    let grab_frame = |rgb_frame: Video, window: &Window| {
        window
            .emit("grab_frame", encode(rgb_frame.data(0)))
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
    let handle = spawn(move || grab_frame_thread(label, width, height, window, rx));
    let name = "grab_frame_thread".to_string();
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

fn main() {
    env_logger::Builder::from_env(Env::default().default_filter_or("debug")).init();
    ffmpeg::init().unwrap();

    info!("Started backend");

    tauri::Builder::default()
        .manage(ManagedAppState(Default::default()))
        .invoke_handler(tauri::generate_handler![settings_choose_camera, settings_close_camera])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
