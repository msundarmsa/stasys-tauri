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

mod camera;
mod mic;
mod thread;
use thread::Thread;
mod settings;
use settings::{display_camera_feed, display_volume};
mod shoot;
use shoot::grab_shoot_frames;

struct ManagedAppState(Mutex<AppState>);
#[derive(Default)]
struct AppState {
    camera_thread: Option<Thread<()>>,
    tx_threshs: Option<Sender<(u32, u32)>>,
    mic_thread: Option<Thread<()>>
}

#[tauri::command]
fn start_shoot(
    camera_label: String,
    mic_label: String,
    calibrate_point: [f64; 2],
    fine_adjust: [f64; 2],
    min_thresh: u32,
    max_thresh: u32,
    window: Window,
    state: State<ManagedAppState>,
) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();

    // start thread to grab camera
    let (camera_tx, camera_rx) = channel();
    let handle = spawn(move || grab_shoot_frames(
        camera_label,
        calibrate_point,
        fine_adjust,
        min_thresh,
        max_thresh,
        false,
        window,
        camera_rx,
    ));
    let name = "grab_shoot_frames".to_string();
    curr_state.camera_thread = Some(Thread{name, handle, tx: camera_tx});

    // remove lock
    drop(curr_state);
}

#[tauri::command]
fn stop_shoot(state: State<ManagedAppState>) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();
    
    if curr_state.camera_thread.is_some() {
        // stop grab frame thread
        curr_state.camera_thread.take().unwrap().terminate();
        curr_state.camera_thread = None;
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
    curr_state.tx_threshs = Some(tx_threshs);

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
        drop(curr_state.tx_threshs.take().unwrap());
        curr_state.tx_threshs = None;
    }

    // remove lock
    drop(curr_state);
}

#[tauri::command]
fn settings_threshs_changed(min_thresh: u32, max_thresh: u32, state: State<ManagedAppState>) {
    // lock mutex to get value
    let mut curr_state = state.0.lock().unwrap();
    
    if curr_state.tx_threshs.is_some() {
        let tx_threshs = curr_state.tx_threshs.take().unwrap();
        tx_threshs.send((min_thresh, max_thresh));
        curr_state.tx_threshs = Some(tx_threshs);
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
        .invoke_handler(tauri::generate_handler![settings_choose_camera, settings_close_camera, settings_choose_mic, settings_close_mic, settings_threshs_changed, start_shoot, stop_shoot])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
