import { Menu, MenuItem, Box, Button, Stack, Typography, Slider } from "@mui/material";
import { useState, useRef, useEffect } from "react";
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

var unlistenGrabFrames: UnlistenFn | null = null;

const Webcam = ({ setCameraId, setCameraThreshs, cameraThreshs, webcams }: IProps) => {
  // menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const openWebcams = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webcamStarted, setWebcamStarted] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState("");
  const THRESH_DIST = 30; // fixed distance between lower and higher threshold

  const closeWebcams = () => {
    setAnchorEl(null);
  };

  async function grabFrames() {
    unlistenGrabFrames = await listen('grab_frame', (event) => {
      if (canvasRef.current === null) {
        return;
      }
      let canvas = canvasRef.current;

      let ctx = canvasRef.current.getContext('2d');
      if (ctx === null) {
        return;
      }

      let imageArr = Uint8ClampedArray.from(
        atob(event.payload as string),
        (c) => c.charCodeAt(0)
      );
      let myImageData = new ImageData(imageArr, imageArr.length / (4 * canvas.height));
      ctx.putImageData(myImageData, 0, 0);
    });
  }

  useEffect(() => {
    grabFrames();

    // stop webcam when element is destroyed
    return () => {
      stopWebcam();

      // stop listening to grab frames
      if (unlistenGrabFrames !== null) {
        unlistenGrabFrames();
        unlistenGrabFrames = null;
      }
    };
  }, []);

  const stopWebcam = () => {
    // send stop signal to tauri backend
    invoke('settings_close_camera');
    setWebcamStarted(false);
    setDeviceLabel("");
  };

  async function selectWebcam(device: MediaDeviceInfo) {
    if (webcamStarted) {
      // stop previous webcam if running before starting new one
      stopWebcam();
    }

    // update state
    setCameraId(device.label);
    setDeviceLabel(device.label);
    setWebcamStarted(true);

    closeWebcams();

    // send start signal to tauri backend
    if (canvasRef.current !== null) {
      let args = {
        label: device.label,
        width: canvasRef.current.width,
        height: canvasRef.current.width,
      };
      invoke('settings_choose_camera', args);
    }
  }

  const cameraThreshsChanged = (newCameraThreshs: number[]) => {
    if (newCameraThreshs[1] - newCameraThreshs[0] != THRESH_DIST) {
      // ensure distance between thresholds is fixed
      if (newCameraThreshs[0] == cameraThreshs[0]) {
        // upper bound changed
        cameraThreshsChanged([newCameraThreshs[1] - THRESH_DIST, newCameraThreshs[1]]);
        return;
      } else {
        // bound changed
        cameraThreshsChanged([newCameraThreshs[0], newCameraThreshs[0] + THRESH_DIST]);
        return;
      }
    }

    // send thresh changed to tauri backend
    /** @todo: call tauri command */
    setCameraThreshs(newCameraThreshs);
  };

  return (
    <div>
      <Menu
        id="webcams-menu"
        aria-labelledby="webcams-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={closeWebcams}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        {webcams.map((device) => (
          <MenuItem key={device.label} onClick={() => selectWebcam(device)}>
            {device.label}
          </MenuItem>
        ))}
      </Menu>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          p: 1,
          m: 1,
          justifyContent: "center",
        }}
      >
        <Button
          id="webcams-menu-btn"
          aria-controls={open ? "webcams-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          onClick={openWebcams}
          variant="contained"
          sx={{ mr: 2 }}
        >
          <span role="img" aria-label="webcam">
            🎥
          </span>
          {deviceLabel === "" ? "Choose a webcam" : deviceLabel}
        </Button>
        {webcamStarted ? (
          <Button onClick={stopWebcam} variant="contained" color="error">
            Close
          </Button>
        ) : null}
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          p: 1,
          m: 1,
          justifyContent: "center",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%", 
            aspectRatio: "1280/720"
          }}
        />
      </Box>
      <Stack spacing={2} direction="row" sx={{ mb: 1 }} alignItems="center">
        <Typography textAlign="center" variant="body1">
          Thresholds
        </Typography>
        <Slider
          value={cameraThreshs}
          min={0}
          max={255}
          // @ts-expect-error: expect error here due to possibility that newLevel be an array
          onChange={(_1, newThreshs, _2) => cameraThreshsChanged(newThreshs)}
        />
      </Stack>
    </div>
  );
};

interface IProps {
  setCameraId: (id: string) => void;
  setCameraThreshs: (threshs: number[]) => void;
  cameraThreshs: number[];
  webcams: MediaDeviceInfo[];
}

export default Webcam;