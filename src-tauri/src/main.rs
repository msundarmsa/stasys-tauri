#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

extern crate ffmpeg_next as ffmpeg;

use log::{info, LevelFilter};
use log4rs::Config;
use log4rs::append::file::FileAppender;
use log4rs::config::{Appender, Root};
use log4rs::encode::pattern::PatternEncoder;
use tauri::{Window, State};
use std::env;
use std::sync::Mutex;
use std::sync::mpsc::{channel, Sender};
use std::thread::spawn;
use std::time::Instant;

mod camera;
mod mic;
mod thread;
use thread::Thread;
mod settings;
use settings::{display_camera_feed, display_volume};
mod shoot;
use shoot::{grab_shoot_frames, mic_trigger};
mod calibrate;
use calibrate::grab_calib_frames;

struct ManagedAppState(Mutex<AppState>);
#[derive(Default)]
struct AppState {
    camera_thread: Option<Thread<()>>,
    threshs_tx: Option<Sender<(u32, u32)>>,
    mic_thread: Option<Thread<()>>,
    trigger_tx: Option<Sender<Instant>>
}

#[tauri::command]
fn start_audio(
    mic_label: String,
    thresh: f64,
    window: Window,
    state: State<ManagedAppState>
) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();
    let curr_trigger_tx = curr_state.trigger_tx.take();

    // create channels to terminate mic threads and for mic triggers
    let (tx, rx) = channel();

    // start thread to grab mic 
    let handle = spawn(move || mic_trigger(
        mic_label,
        thresh,
        window,
        curr_trigger_tx,
        rx
    ));
    let name = "mic_trigger".to_string();
    curr_state.mic_thread = Some(Thread{name, handle, tx});

    // remove lock
    drop(curr_state);
}

#[tauri::command]
fn start_calib_video(
    camera_label: String,
    min_thresh: u32,
    max_thresh: u32,
    window: Window,
    state: State<ManagedAppState>,
) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();

    // create channels to terminate camera and mic threads and for mic triggers
    let (tx, rx) = channel();
    let (trigger_tx, trigger_rx) = channel();

    // start thread to grab camera
    let handle = spawn(move || grab_calib_frames(
        camera_label,
        min_thresh,
        max_thresh,
        trigger_rx,
        window,
        rx,
    ));
    let name = "grab_calib_frames".to_string();
    curr_state.camera_thread = Some(Thread{name, handle, tx});
    curr_state.trigger_tx = Some(trigger_tx);

    // remove lock
    drop(curr_state);
}

#[tauri::command]
fn start_shoot_video(
    camera_label: String,
    calibrate_point: [f64; 2],
    fine_adjust: [f64; 2],
    min_thresh: u32,
    max_thresh: u32,
    window: Window,
    state: State<ManagedAppState>,
) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();

    // create channels to terminate camera and mic threads and for mic triggers
    let (tx, rx) = channel();
    let (trigger_tx, trigger_rx) = channel();

    // start thread to grab camera
    let handle = spawn(move || grab_shoot_frames(
        camera_label,
        calibrate_point,
        fine_adjust,
        min_thresh,
        max_thresh,
        true,
        trigger_rx,
        window,
        rx,
    ));
    let name = "grab_shoot_frames".to_string();
    curr_state.camera_thread = Some(Thread{name, handle, tx});
    curr_state.trigger_tx = Some(trigger_tx);

    // remove lock
    drop(curr_state);
}

#[tauri::command]
fn stop_webcam_and_mic(state: State<ManagedAppState>) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();
    
    if curr_state.camera_thread.is_some() {
        // stop video thread
        curr_state.camera_thread.take().unwrap().terminate();
        curr_state.camera_thread = None;
    }

    if curr_state.mic_thread.is_some() {
        // stop audio thread
        curr_state.mic_thread.take().unwrap().terminate();
        curr_state.mic_thread = None;
    }

    // remove lock
    drop(curr_state);
}

#[tauri::command]
fn settings_choose_camera(
    label: String,
    width: u32,
    height: u32,
    min_thresh: u32,
    max_thresh: u32,
    window: Window,
    state: State<ManagedAppState>,
) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();
    
    // create channel to communicate threshold changes
    let (tx_threshs, rx_threshs) = channel();
    curr_state.threshs_tx = Some(tx_threshs);

    // start thread to grab camera
    let (tx, rx) = channel();
    let handle = spawn(move || display_camera_feed(label, width, height, min_thresh, max_thresh, window, rx, rx_threshs));
    let name = "display_camera_feed".to_string();
    curr_state.camera_thread = Some(Thread{name, handle, tx});

    // remove lock
    drop(curr_state);
}

#[tauri::command]
fn settings_close_camera(state: State<ManagedAppState>) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();
    
    if curr_state.camera_thread.is_some() {
        // stop grab frame thread
        curr_state.camera_thread.take().unwrap().terminate();
        curr_state.camera_thread = None;

        // close threshold changes channel
        drop(curr_state.threshs_tx.take().unwrap());
        curr_state.threshs_tx = None;
    }

    // remove lock
    drop(curr_state);
}

#[tauri::command]
fn settings_threshs_changed(min_thresh: u32, max_thresh: u32, state: State<ManagedAppState>) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();
    
    if curr_state.threshs_tx.is_some() {
        let tx_threshs = curr_state.threshs_tx.take().unwrap();
        tx_threshs.send((min_thresh, max_thresh));
        curr_state.threshs_tx = Some(tx_threshs);
    }

    // remove lock
    drop(curr_state);
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
    let handle = spawn(move || display_volume(label, window, rx));
    let name = "display_volume".to_string();
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
    let logdir = env::current_exe().unwrap().parent().unwrap().join("STASYS.log");

    // create log file appender
    let logfile = FileAppender::builder()
    .encoder(Box::new(PatternEncoder::default()))
    .build(logdir)
    .unwrap();

    // add the logfile appender to the config
    let config = Config::builder()
    .appender(Appender::builder().build("logfile", Box::new(logfile)))
    .build(Root::builder().appender("logfile").build(LevelFilter::Info))
    .unwrap();

    // init log4rs
    log4rs::init_config(config).unwrap();

    ffmpeg::init().unwrap();

    info!("Started backend");

    tauri::Builder::default()
        .manage(ManagedAppState(Default::default()))
        .invoke_handler(tauri::generate_handler![settings_choose_camera, settings_close_camera, settings_choose_mic, settings_close_mic, settings_threshs_changed, start_shoot_video, start_audio, stop_webcam_and_mic, start_calib_video])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
