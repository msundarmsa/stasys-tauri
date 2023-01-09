import {
  Box,
  Button,
  Menu,
  MenuItem,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import { useState, useEffect } from "react";
import LineChart from "./LineChart";
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

var unlisten: UnlistenFn | null = null;

const Mic = ({ setMicId, setMicThresh, micThresh, mics, micId }: IProps) => {
  // menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const openMics = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const [micStarted, setMicStarted] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [data, setData] = useState<{ x: number; y: number }[]>([]);

  const closeMics = () => {
    setAnchorEl(null);
  };

  async function grabFrames() {
    unlisten = await listen('grab_mic_frame', (event) => {
      setData((oldData) => {
        // update previous data
        const newData = [...oldData];

        // set new x
        let newX = 0;
        if (newData.length > 0) {
          // newX = newData[newData.length - 1].x + intervalMs / 1000;
          newX = newData[newData.length - 1].x + 0.1;
        }

        if (newX > 5) {
          newData.shift();
        }

        // get data from audio stream
        const newY = event.payload as number;

        newData.push({ x: newX, y: newY });
        return newData;
      });
    });
  }

  useEffect(() => {
    grabFrames();
    selectMic(micId);

    // stop mic when element is destroyed
    return () => {
      stopMic();

      // stop listening to grab frames
      if (unlisten !== null) {
        unlisten();
        unlisten = null;
      }
    };
  }, []);

  const stopMic = () => {
    // send stop signal to tauri backend
    invoke('settings_close_mic');

    setMicStarted(false);
    setDeviceLabel("");
    setData([]);
  };

  async function selectMic(device_label: string) {
    if (micStarted) {
      // stop previous mic if running before starting new one
      stopMic();
    }

    // update state
    setMicStarted(true);
    setDeviceLabel(device_label);
    setMicId(device_label);
    closeMics();

    // send start signal to tauri backend
    let args = {
      label: device_label,
    };
    invoke('settings_choose_mic', args);
  }

  return (
    <div>
      <Menu
        id="mics-menu"
        aria-labelledby="mics-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={closeMics}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        {mics.map((device) => (
          <MenuItem key={device} onClick={() => selectMic(device)}>
            {device}
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
          aria-controls={open ? "mics-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          onClick={openMics}
          variant="contained"
          sx={{ mr: 2 }}
        >
          <span role="img" aria-label="mic">
            🎙
          </span>
          {deviceLabel === "" ? "Choose a mic" : deviceLabel}
        </Button>
        {micStarted ? (
          <Button onClick={stopMic} variant="contained" color="error">
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
        <LineChart
          lines={data.length == 0 ? [] : [data]}
          refLevel={micThresh}
          name="micplot"
          aspectRatio="1280/720"
          yMax={2}
        />
      </Box>
      <Stack spacing={2} direction="row" sx={{ mb: 1 }} alignItems="center">
        <Typography textAlign="center" variant="body1">
          Threshold
        </Typography>
        <Slider
          value={micThresh}
          step={0.001}
          min={0}
          max={2}
          onChange={(_1, newLevel, _2) => {
            // @ts-expect-error: expect error here due to possibility that newLevel be an array
            setMicThresh(newLevel);
          }}
        />
      </Stack>
    </div>
  );
};

interface IProps {
  setMicId: (id: string) => void;
  setMicThresh: (thresh: number) => void;
  micThresh: number;
  mics: string[];
  micId: string;
}

export default Mic;
