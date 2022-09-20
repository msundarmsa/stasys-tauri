import { Alert, AlertColor, AppBar, Box, Button, IconButton, Modal, Snackbar, Toolbar, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useEffect, useState } from "react";
import SettingsPage from "./SettingsPage";

export default function MainPage() {
  // settings modal
  const [settingsPageOpen, setSettingsPageOpen] = useState(false);
  const handleSettingsPageOpen = () => setSettingsPageOpen(true);
  const handleSettingsPageClose = () => setSettingsPageOpen(false);

  // toasts
  const [toastOpen, setToastOpen] = useState(false);
  const handleToastOpen = () => setToastOpen(true);
  const handleToastClose = () => setToastOpen(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastSeverity, setToastSeverity] = useState<AlertColor>("info");
  const showToast = (severity: AlertColor, msg: string) => {
    setToastMsg(msg);
    setToastSeverity(severity);
    handleToastOpen();
  };

  // user options
  const [webcams, setWebcams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [micThresh, setMicThresh] = useState(0.2);
  const [cameraThreshs, setCameraThreshs] = useState<number[]>([100, 150]);

  // buttons
  const [calibrateStarted, setCalibrateStarted] = useState(false);
  const [shootStarted, setShootStarted] = useState(false);

  const testClick = () => {
    showToast("error", "Test button not implemented");
  };

  const shootClick = () => {
    showToast("error", "Shoot button not implemented");
  };

  const calibrateClick = () => {
    showToast("error", "Calibrate button not implemented");
  };

  useEffect(() => {
    chooseDefaultCameraAndMic();
  }, []);

  async function chooseDefaultCameraAndMic() {
    // initiate permission
    const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
    });

    // prevent devices from being read
    stream.getTracks().forEach(function (track) {
        track.stop();
    });

    const mydevices = await navigator.mediaDevices.enumerateDevices();

    // get webcams
    const webcams = mydevices.filter((device) => device.kind === "videoinput");

    // get mics
    const mics = mydevices.filter(
      (device) =>
        device.kind === "audioinput" && !device.label.startsWith("Default")
    );

    const user_chose_video = cameraId != "";
    const user_chose_audio = micId != "";
    let usbAudioExists = false;
    let usbVideoExists = false;

    // choose webcam with name "USB" if user has not selected video
    for (let i = 0; i < webcams.length; i++) {
      if (webcams[i].label.includes("USB") && !user_chose_video) {
        setCameraId(webcams[i].label);
        usbVideoExists = true;
      }
    }

    // choose mic with name "USB" if user has not selected audio
    for (let i = 0; i < mics.length; i++) {
      if (mics[i].label.includes("USB") && !user_chose_audio) {
        setMicId(mics[i].label);
        usbAudioExists = true;
      }
    }

    if (webcams.length == 0) {
      showToast("error", "No webcams found!");
      return;
    }

    if (mics.length == 0) {
      showToast("error", "No mics found!");
      return;
    }

    if (
      (!user_chose_video && !usbVideoExists) ||
      (!user_chose_audio && !usbAudioExists)
    ) {
      setCameraId(webcams[0].label);
      setMicId(mics[0].label);
      showToast(
        "info",
        "Could not find USB camera/mic. Chosen first available camera/mic. If you would like to change this please go to settings dialog and manually select the camera and microphone."
      );
    }

    setWebcams(webcams);
    setMics(mics);
  }
  
  return (
    <div
      style={{
        display: "flex",
        flexFlow: "column",
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
      }}
    >
      <AppBar position="static">
        <Toolbar>
          <img
            src="/images/logo.svg"
            height="20"
            width="20"
            style={{ verticalAlign: "middle", marginRight: 10 }}
          />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            STASYS
          </Typography>
          <Button color="secondary" onClick={testClick}>
            TEST
          </Button>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            onClick={handleSettingsPageOpen}
          >
            <SettingsIcon />
          </IconButton>
          <Modal
            open={settingsPageOpen}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
          >
            <Box sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "50%",
              bgcolor: "background.paper",
              border: "2px solid #000",
              boxShadow: 24,
              p: 4,
            }}>
              <SettingsPage
                setCameraId={setCameraId}
                setCameraThreshs={setCameraThreshs}
                cameraThreshs={cameraThreshs}
                setMicId={setMicId}
                setMicThresh={setMicThresh}
                micThresh={micThresh}
                webcams={webcams}
                mics={mics}
                handleClose={handleSettingsPageClose}
              />
            </Box>
          </Modal>
          <Button
            color={"info"}
            onClick={calibrateClick}
            variant={calibrateStarted ? "contained" : "outlined"}
            style={{ marginRight: "10px" }}
          >
            {calibrateStarted ? "CALIBRATING" : "CALIBRATE"}
          </Button>
          <Button
            color={"success"}
            onClick={shootClick}
            variant={shootStarted ? "contained" : "outlined"}
          >
            {shootStarted ? "SHOOTING" : "SHOOT"}
          </Button>
        </Toolbar>
      </AppBar>
      <Snackbar
        open={toastOpen}
        autoHideDuration={5000}
        onClose={handleToastClose}
      >
        <Alert
          onClose={handleToastClose}
          severity={toastSeverity}
          sx={{ width: "100%" }}
        >
          {toastMsg}
        </Alert>
      </Snackbar>
    </div>
  );
}