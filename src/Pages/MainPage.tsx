import { AppBar, Box, Button, IconButton, Modal, Toolbar, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useState } from "react";

export default function MainPage() {
  // settings modal
  const [settingsPageOpen, setSettingsPageOpen] = useState(false);
  const handleSettingsPageOpen = () => setSettingsPageOpen(true);
  const handleSettingsPageClose = () => setSettingsPageOpen(false);
  

  // user options
  const [webcams, setWebcams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [micThresh, setMicThresh] = useState(0.2);

  // buttons
  const [calibrateStarted, setCalibrateStarted] = useState(false);
  const [shootStarted, setShootStarted] = useState(false);

  const testClick = () => {
    console.error("Test button not implemented");
  };

  const shootClick = () => {
    console.error("Shoot button not implemented");
  };

  const calibrateClick = () => {
    console.error("Calibrate button not implemented");
  };
  
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
              {/* <SettingsPage
                setCameraId={setCameraId}
                setMicId={setMicId}
                setMicThresh={setMicThresh}
                micThresh={micThresh}
                webcams={webcams}
                mics={mics}
                handleClose={handleSettingsPageClose}
              /> */}
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
    </div>
  );
}