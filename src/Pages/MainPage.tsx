import { Alert, AlertColor, AppBar, Box, Button, IconButton, Modal, Snackbar, Toolbar, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useEffect, useRef, useState } from "react";
import SettingsPage from "./SettingsPage";
import { listen } from '@tauri-apps/api/event';
import { Target } from "./components/Target";
import { Shot, TARGET_SIZE } from "../ShotUtils";
import ScoreStatCard from "./components/ScoreStatCard";

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

  // target and zoomed target
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotGroups, setShotGroups] = useState<Shot[][]>([]);
  const [allShots, setAllShots] = useState<Shot[]>([]);
  const [shot, setShot] = useState<Shot>();
  const [shotPoint, setShotPoint] = useState<[number, number]>();
  const [prevBefore, setPrevBefore] = useState<[number, number]>();
  const [prevAfter, setPrevAfter] = useState<[number, number]>();
  const [beforeTrace, setBeforeTrace] = useState<[number, number]>();
  const [afterTrace, setAfterTrace] = useState<[number, number]>();
  const [data, setData] = useState<{ x: number; y: number }[][]>([]);

  // user options
  const [webcams, setWebcams] = useState<string[]>([]);
  const [mics, setMics] = useState<string[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [micThresh, setMicThresh] = useState(0.2);
  const [cameraThreshs, setCameraThreshs] = useState<number[]>([120, 150]);

  // buttons
  const [calibrateStarted, setCalibrateStarted] = useState(false);
  const [shootStarted, setShootStarted] = useState(false);

  const incrFineAdjust = (x: number, y: number) => {
      // TODO: increment fine adjust
      // electron.ipcRenderer.sendMsgOnChannel("camera-render-channel",
      //   { cmd: "INCR_FINE_ADJUST", fineAdjust: {x: x, y: y} });
  }

  const [fineAdjustment, setFineAdjustment] = useState<number[]>([-1, -1]);
  const [fineAdjustmentStarted, setFineAdjustmentStarted] = useState(false);
  const [fineAdjustmentStart, setFineAdjustmentStart] = useState<number[]>([-1, -1]);
  const [showAdjustment, setShowAdjustment] = useState(false);

  const handleFineAdjustmentStart = (e: React.MouseEvent<SVGCircleElement>) => {
    if (calibrateStarted) {
      showToast("error", "Please wait for calibration to finish or stop calibration. Before adjusting shot.");
      return;
    }
    if (shootStarted) {
      showToast("error", "Please wait for shooting to finish or stop shooting. Before adjusting shot.");
      return;
    }

    setShowAdjustment(true);
    setFineAdjustment([e.currentTarget.cx.baseVal.value, e.currentTarget.cy.baseVal.value]);
    setFineAdjustmentStart([e.currentTarget.cx.baseVal.value, e.currentTarget.cy.baseVal.value]);
    setFineAdjustmentStarted(true);
  };

  const handleFineAdjustmentMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (fineAdjustmentStarted) {
      setFineAdjustment([e.nativeEvent.offsetX, e.nativeEvent.offsetY]);
    }
  };

  const handleFineAdjustmentEnd = (e: React.MouseEvent<SVGSVGElement>) => {
    if (fineAdjustmentStarted) {
      setFineAdjustment([e.nativeEvent.offsetX, e.nativeEvent.offsetY]);
      setFineAdjustmentStarted(false);

      const distX = e.nativeEvent.offsetX - fineAdjustmentStart[0];
      const distY = fineAdjustmentStart[1] - e.nativeEvent.offsetY;

      if (canvasRef.current) {
        incrFineAdjust(
          2 * distX / canvasRef.current?.width * TARGET_SIZE,
          2 * distY / canvasRef.current?.height * TARGET_SIZE
        );
      }
    }
  };

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
    listen('show_message', (event) => {
      showToast("info", event.payload as string);
    });
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
    const webcams = mydevices
      .filter((device) => device.kind === "videoinput")
      .map((device, _1, _2) => device.label.split(' (')[0]);

    // get mics
    const mics = mydevices.filter(
      (device) =>
        device.kind === "audioinput" && !device.label.startsWith("Default") && !device.label.startsWith("Communications")
    ).map((device, _1, _2) => device.label.split(/ \([0-9]/)[0]);

    const user_chose_video = cameraId != "";
    const user_chose_audio = micId != "";
    let usbAudioExists = false;
    let usbVideoExists = false;

    // choose webcam with name "USB" if user has not selected video
    for (let i = 0; i < webcams.length; i++) {
      if (webcams[i].includes("USB") && !user_chose_video) {
        setCameraId(webcams[i]);
        usbVideoExists = true;
      }
    }

    // choose mic with name "USB" if user has not selected audio
    for (let i = 0; i < mics.length; i++) {
      if (mics[i].includes("USB") && !user_chose_audio) {
        setMicId(mics[i]);
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
      setCameraId(webcams[0]);
      setMicId(mics[0]);
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
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          gap: "10px",
          margin: "10px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "0 0 45%",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              flex: "90%",
              border: shootStarted ? "1px solid #D7EC58" : calibrateStarted ? "1px solid #51D6FF" : "1px solid #FF4242",
              borderRadius: "25px",
              overflow: "hidden",
            }}
          >
            <Target
              shots={shots}
              shotPoint={shotPoint}
              prevBefore={prevBefore}
              prevAfter={prevAfter}
              setPrevBefore={setPrevBefore}
              setPrevAfter={setPrevAfter}
              newBefore={beforeTrace}
              newAfter={afterTrace}
              canvasRef={canvasRef}
              handleFineAdjustmentStart={handleFineAdjustmentStart}
              handleFineAdjustmentMove={handleFineAdjustmentMove}
              handleFineAdjustmentEnd={handleFineAdjustmentEnd}
              fineAdjustment={fineAdjustment}
              fineAdjustmentStart={fineAdjustmentStart}
              showAdjustment={showAdjustment}
            />
          </div>
          <div style={{ flex: "10%", display: "flex" }}>
            <ScoreStatCard
              scoreStatType="STABILITY"
              scoreStat={shot ? shot.stab : 0}
              dp={0}
              suffix="%"
            />
            <ScoreStatCard
              scoreStatType="DESCENT TIME"
              scoreStat={shot ? shot.desc : 0}
              dp={1}
              suffix="s"
            />
            <ScoreStatCard
              scoreStatType="AIM TIME"
              scoreStat={shot ? shot.aim : 0}
              dp={1}
              suffix="s"
            />
          </div>
        </div>
      </div>
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