use std::sync::mpsc::{Receiver, RecvError};
use log::info;
use tauri::Window;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

fn get_volume_i16(input: &[i16]) -> f64 {
    let mut volume = 0.0;
    let mut n_samples = input.len() as f64;
    for &sample in input.iter() {
        let curr_sample = sample as f64;
        volume += curr_sample * curr_sample;
    }

    volume /= n_samples;
    volume = volume.sqrt();

    return volume;
}

fn get_volume_f32(input: &[f32]) -> f64 {
    let mut volume = 0.0;
    let n_samples = input.len() as f64;
    for &sample in input.iter() {
        let curr_sample = sample as f64;
        volume += curr_sample * curr_sample;
    }

    volume /= n_samples;
    volume = volume.sqrt();

    if cfg!(windows) {
        volume *= 200.0;
    }

    return volume;
}

pub fn mic_stream(label: String, window: Window, rx: Receiver<()>, grab_frame: fn(f64, &Window)) -> Result<(), anyhow::Error> {
    info!("Starting mic {:}", label);
    
    let host = cpal::default_host();
    let device = host.input_devices()?
            .find(|x| x.name().map(|y| y == label).unwrap_or(false))
            .expect("failed to find input device");
    
    let config = device
        .default_input_config()
        .expect("Failed to get default input config");

    let err_fn = move |err| {
        eprintln!("an error occurred on stream: {}", err);
    };

    let stream = match config.sample_format() {
        cpal::SampleFormat::I16 => device.build_input_stream(
            &config.into(),
            move |data, _: &_| grab_frame(get_volume_i16(data), &window),
            err_fn,
        )?,
        cpal::SampleFormat::F32 => device.build_input_stream(
            &config.into(),
            move |data, _: &_| grab_frame(get_volume_f32(data), &window),
            err_fn,
        )?,
        sample_format => {
            return Err(anyhow::Error::msg(format!(
                "Unsupported sample format {:?}", sample_format
            )))
        }
    };

    stream.play()?;

    match rx.recv() {
        Ok(_) | Err(RecvError) => {
            info!("Terminating mic stream thread");
        }
    }

    drop(stream);

    Ok(())
}
