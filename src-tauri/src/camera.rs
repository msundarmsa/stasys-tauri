extern crate ffmpeg_next as ffmpeg;
extern crate base64;

use ffmpeg::ffi::*;
use ffmpeg::format::{context::Input, Pixel};
use ffmpeg::software::scaling::{context::Context, flag::Flags};
use ffmpeg::util::frame::video::Video;
use ffmpeg::{Dictionary, Error};
use opencv::prelude::*;

use std::ffi::CString;
use std::path::Path;
use std::ptr;
use std::sync::mpsc::{Receiver, TryRecvError};
use log::{info, error, warn};
use tauri::Window;

fn path_to_cstr<P: AsRef<Path>>(path: &P) -> CString {
    CString::new(path.as_ref().as_os_str().to_str().unwrap()).unwrap()
}

fn get_camera_input(label: String) -> Result<Input, Error> {
    let mut options = Dictionary::new();
    if label.contains("USB") {
        options.set("framerate", "120");
    } else {
        options.set("framerate", "30");
    }
    options.set("pixel_format", "bgr0");

    unsafe {
        let mut ps = ptr::null_mut();
        let path = path_to_cstr(&label);
        let mut opts = options.disown();
        let format;
        if cfg!(target_os = "macos") {
            format = CString::new("avfoundation").unwrap();
        } else if cfg!(windows) {
            format = CString::new("dshow").unwrap();
        } else{
            error!("Operating system not supported");
            return Err(Error::Bug);
        }
        let fmt = av_find_input_format(format.as_ptr());

        if fmt == ptr::null_mut() {
            warn!("fmt is null ptr");
        }
        let res = avformat_open_input(&mut ps, path.as_ptr(), fmt, &mut opts);

        Dictionary::own(opts);

        match res {
            0 => match avformat_find_stream_info(ps, ptr::null_mut()) {
                r if r >= 0 => Ok(Input::wrap(ps)),
                e => {
                    avformat_close_input(&mut ps);
                    Err(Error::from(e))
                }
            },

            e => Err(Error::from(e)),
        }
    }
}

pub fn camera_stream(label: String, width: u32, height: u32, window: Window, rx: Receiver<()>, grab_frame: fn(Mat, &Window)) -> Result<(), Error> {
    info!("Starting camera {:} ({:} x {:})", label, width, height);
    
    let mut input = match get_camera_input(label) {
        Ok(input) => input,
        Err(e) => {
            error!("Could not initialize camera ({:})", e.to_string());
            // TODO: emit toast error event with error "Could not initialize camera".to_string()
            return Err(Error::Bug);
        }
    };

    let stream = match input.streams().best(ffmpeg::media::Type::Video) {
        Some(s) => s,
        None => {
            error!("Could not video stream from camera");
            return Err(Error::Bug);
        }
    };

    let stream_index = stream.index();

    let context_decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())?;
    let mut decoder = context_decoder.decoder().video()?;

    let new_width = if width != 0 { width } else { decoder.width() };
    let new_height = if height != 0 { height } else { decoder.height() };
    let mut scaler = Context::get(
        decoder.format(),
        decoder.width(),
        decoder.height(),
        Pixel::RGB24,
        new_width,
        new_height,
        Flags::BICUBIC,
    )?;

    let mut frame_index = 0;
    let window_ref = &window;

    for (stream, packet) in input.packets() {
        if stream.index() == stream_index {
            decoder.send_packet(&packet)?;

            let mut decoded = Video::empty();
            if decoder.receive_frame(&mut decoded).is_ok() {
                if frame_index == 0 {
                    info!("Reading frames...");
                }

                let mut rgb_frame = Video::empty();
                scaler.run(&decoded, &mut rgb_frame)?;

                let mat = match Mat::from_slice(rgb_frame.data(0)) {
                    Ok(res) => {
                        match res.reshape(3, new_height as i32) {
                            Ok(res2) => res2,
                            Err(error) =>{
                                error!("Could not reshape matrix ({:})", error);
                                continue;
                            } 
                        }
                    },
                    Err(error) => {
                        error!("Could not convert frame to Mat ({:})", error);
                        continue;
                    }
                };

                grab_frame(mat, window_ref);
                frame_index += 1;
            }
        }

        match rx.try_recv() {
            Ok(_) | Err(TryRecvError::Disconnected) => {
                info!("Terminating camera stream thread");
                break;
            }
            Err(TryRecvError::Empty) => {}
        }
    }

    decoder.send_eof()?;

    Ok(())
}
