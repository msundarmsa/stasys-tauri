use std::{thread::JoinHandle, sync::mpsc::Sender};
use log::{info, error};

pub struct Thread<T> {
    pub name: String,
    pub handle: JoinHandle<T>,
    pub tx: Sender<()>
}

impl<T> Thread<T> {
    pub fn terminate(self) {
        match self.tx.send(()) {
            Ok(_) => info!("Sent terminate signal to {:}", self.name),
            Err(error) => error!("Could not send terminate signal to {:} ({:?})", self.name, error)
        }
        match self.handle.join() {
            Ok(_) => info!("Thread {:} joined successfully", self.name),
            Err(error) => error!("Thread {:} could not be joined ({:?})", self.name, error)
        }

        drop(self.tx); // close channel
    }
}