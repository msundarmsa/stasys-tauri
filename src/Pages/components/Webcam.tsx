import { Menu, MenuItem, Box, Button, Stack, Typography, Slider } from "@mui/material";
import { useState, useRef, useEffect, ChangeEvent } from "react";
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/api/dialog';

var unlisten: UnlistenFn | null = null;

const Webcam = ({ setCameraId, setCameraThreshs, cameraThreshs, webcams, cameraId }: IProps) => {
  // menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const webcamsOpened = Boolean(anchorEl);
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
    unlisten = await listen('grab_camera_frame', (event) => {
      let canvas = canvasRef.current;
      if (canvas === null) {
        return;
      }

      let ctx = canvas.getContext('2d');
      if (ctx === null) {
        return;
      }

      let imageArr = Uint8ClampedArray.from(
        atob(event.payload as string),
        (c) => c.charCodeAt(0)
      );
      // const { width, height } = canvas.getBoundingClientRect();
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      let myImageData = new ImageData(imageArr, Math.floor(width), Math.floor(height));
      ctx.putImageData(myImageData, 0, 0);
    });
  }

  useEffect(() => {
    grabFrames();
    selectWebcam(cameraId, cameraId.includes("/") || cameraId.includes("\\"));

    // stop webcam when element is destroyed
    return () => {
      stopWebcam();

      // stop listening to grab frames
      if (unlisten !== null) {
        unlisten();
        unlisten = null;
      }
    };
  }, []);

  const stopWebcam = () => {
    // send stop signal to tauri backend
    invoke('settings_close_camera');
    setWebcamStarted(false);
    setDeviceLabel("");
  };

  async function selectWebcam(device_label: string, is_file: boolean) {
    if (webcamStarted) {
      // stop previous webcam if running before starting new one
      stopWebcam();
    }

    // update state
    setCameraId(device_label);
    if (is_file) {
      setDeviceLabel(device_label.split(/(\\|\/)/g).pop() as string);
    } else {
      setDeviceLabel(device_label);
    }
    setWebcamStarted(true);
    closeWebcams();

    // send start signal to tauri backend
    if (canvasRef.current !== null) {
      const { width, height } = canvasRef.current.getBoundingClientRect();
      let args = {
        label: device_label,
        width: Math.floor(width),
        height: Math.floor(height),
        minThresh: cameraThreshs[0],
        maxThresh: cameraThreshs[1]
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
    let args = {
      minThresh: newCameraThreshs[0],
      maxThresh: newCameraThreshs[1]
    };
    invoke('settings_threshs_changed', args);
    setCameraThreshs(newCameraThreshs);
  };

  const chooseFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Video',
        extensions: ['mp4', 'mkv']
      }]
    });
    if (selected !== null) {
      selectWebcam(selected as string, true);
    }
  }

  return (
    <div>
      <Menu
        id="webcams-menu"
        aria-labelledby="webcams-menu"
        anchorEl={anchorEl}
        open={webcamsOpened}
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
        {webcams.map((webcam) => (
          <MenuItem key={webcam} onClick={() => selectWebcam(webcam, false)}>
            {webcam}
          </MenuItem>
        ))}
        <MenuItem key="Choose File" onClick={chooseFile}>
          Choose File
        </MenuItem>
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
          aria-controls={webcamsOpened ? "webcams-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={webcamsOpened ? "true" : undefined}
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
  webcams: string[];
  cameraId: string;
}

export default Webcam;