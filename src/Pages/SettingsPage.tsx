import { Typography, Box, Button } from "@mui/material";
import Webcam from "./components/Webcam";
import Mic from "./components/Mic";

const SettingsPage = ({
  setCameraId,
  setCameraThreshs,
  cameraThreshs,
  setMicId,
  setMicThresh,
  micThresh,
  webcams,
  mics,
  cameraId,
  micId,
  handleClose
}: IProps) => {
  return (
    <div>
      <Typography textAlign="center" variant="h3">
        Settings
      </Typography>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          p: 1,
          m: 1,
        }}
      >
        <Box sx={{ width: "50%", p: 1 }}>
          <Mic setMicId={setMicId} setMicThresh={setMicThresh} micThresh={micThresh} mics={mics} micId={micId}/>
        </Box>
        <Box sx={{ width: "50%", p: 1 }}>
          <Webcam setCameraId={setCameraId} setCameraThreshs={setCameraThreshs} cameraThreshs={cameraThreshs} webcams={webcams} cameraId={cameraId} /> 
        </Box>
      </Box>
      <Box textAlign='center'>
        <Button variant='contained' color='secondary' onClick={handleClose}>
          Save & Close
        </Button>
      </Box>
    </div>
  );
}

interface IProps {
  setCameraId: (id: string) => void;
  setCameraThreshs: (threshs: number[]) => void;
  cameraThreshs: number[];
  setMicId: (id: string) => void;
  setMicThresh: (thresh: number) => void;
  micThresh: number;
  webcams: string[];
  mics: string[];
  cameraId: string;
  micId: string;
  handleClose: () => void;
}

export default SettingsPage;