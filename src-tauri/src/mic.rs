extern crate ffmpeg_next as ffmpeg;
extern crate base64;

use ffmpeg::ffi::*;
use ffmpeg::format::context::Input;
use ffmpeg::util::frame::audio::Audio;
use ffmpeg::Error;

use std::ffi::CString;
use std::path::Path;
use std::ptr;
use std::sync::mpsc::{Receiver, TryRecvError};
use log::{info, error, warn};
use tauri::Window;
use std::time::Instant;

fn path_to_cstr<P: AsRef<Path>>(path: &P) -> CString {
    CString::new(path.as_ref().as_os_str().to_str().unwrap()).unwrap()
}

fn get_mic_input(label: String) -> Result<Input, Error> {
    unsafe {
        let mut ps = ptr::null_mut();
        let format;
        let mut new_label = label.clone();
        if cfg!(target_os = "macos") {
            format = CString::new("avfoundation").unwrap();
            new_label = format!(":{:}", label);
        } else if cfg!(windows) {
            format = CString::new("dshow").unwrap();
            new_label = format!("audio={:}", label);
        } else{
            error!("Operating system not supported");
            return Err(Error::Bug);
        }
        let fmt = av_find_input_format(format.as_ptr());

        if fmt == ptr::null_mut() {
            warn!("fmt is null ptr");
        }
        let path = path_to_cstr(&new_label);
        let res = avformat_open_input(&mut ps, path.as_ptr(), fmt, ptr::null_mut());

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

pub fn mic_stream(label: String, window: Window, rx: Receiver<()>, grab_frame: fn(f64, &Window)) -> Result<(), Error> {
    info!("Starting mic {:}", label);
    
    let mut input = match get_mic_input(label) {
        Ok(input) => input,
        Err(e) => {
            error!("Could not initialize mic ({:})", e.to_string());
            // TODO: emit toast error event with error "Could not initialize camera".to_string()
            return Err(Error::Bug);
        }
    };

    let stream = match input.streams().best(ffmpeg::media::Type::Audio) {
        Some(s) => s,
        None => {
            error!("Could not video stream from mic");
            return Err(Error::Bug);
        }
    };

    let stream_index = stream.index();

    let context_decoder = ffmpeg::codec::context::Context::from_parameters(stream.parameters())?;
    let mut decoder = context_decoder.decoder().audio()?;

    let mut frame_index = 0;
    let start_time = Instant::now();
    let window_ref = &window;

    for (stream, packet) in input.packets() {
        if stream.index() == stream_index {
            decoder.send_packet(&packet)?;

            let mut decoded = Audio::empty();
            if decoder.receive_frame(&mut decoded).is_ok() {
                if frame_index == 0 {
                    info!("Reading audio frames...");
                    info!("Audio format: {:}", decoded.format().name());
                }

                let data = decoded.data(0);
                let mut volume = 0.0;
                let mut n_samples = 0.0;
                if cfg!(target_os = "macos") {
                    // audio format is usually f64
                    for sample in data.chunks(4) {
                        let mut sample_4: [u8; 4] = Default::default();
                        sample_4.copy_from_slice(sample);
                        let sample = f32::from_le_bytes(sample_4) as f64;
                        volume += sample * sample;
                        n_samples += 1.0;
                    }
                } else if cfg!(windows) {
                    // audio format is usually s16
                    for sample in data.chunks(2) {
                        let mut sample_2: [u8; 2] = Default::default();
                        sample_2.copy_from_slice(sample);
                        let sample = i16::from_le_bytes(sample_2) as f64 / 32.768;
                        volume += sample * sample;
                        n_samples += 1.0;
                    }
                } else{
                    error!("Operating system not supported");
                    return Err(Error::Bug);
                }

                volume /= n_samples;
                volume = volume.sqrt();

                grab_frame(volume, window_ref);

                frame_index += 1;

                let fps = frame_index as f64 / start_time.elapsed().as_secs_f64();
                info!("FPS: {:}", fps);
            }
        }

        match rx.try_recv() {
            Ok(_) | Err(TryRecvError::Disconnected) => {
                info!("Terminating mic stream thread");
                break;
            }
            Err(TryRecvError::Empty) => {}
        }
    }

    decoder.send_eof()?;

    Ok(())
}
