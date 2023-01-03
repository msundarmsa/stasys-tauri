import {
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import { Shot, toDP } from "../../ShotUtils";

const ShotTable = ({ shots }: { shots: Shot[] }) => (
  <TableContainer component={Paper} style={{ maxHeight: "100%" }}>
    <Table stickyHeader aria-label="simple table" size="small" padding="checkbox">
      <TableHead>
        <TableRow>
          <TableCell>#</TableCell>
          <TableCell align="center">Score</TableCell>
          <TableCell align="center">Direction</TableCell>
          <TableCell align="center">Stab</TableCell>
          <TableCell align="center">Desc</TableCell>
          <TableCell align="center">Aim</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {shots.map((shot) => (
          <TableRow
            key={shot.id}
            sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
          >
            <TableCell component="th" scope="row">
              {shot.id}
            </TableCell>
            <TableCell align="center">{toDP(shot.score, 1)}</TableCell>
            <TableCell align="center">
              <img
                src={`images/arrow_${shot.direction}.svg`}
                width="40"
                height="40"
              />
            </TableCell>
            <TableCell align="center">{toDP(shot.stab, 0)}%</TableCell>
            <TableCell align="center">{toDP(shot.desc, 1)}s</TableCell>
            <TableCell align="center">{toDP(shot.aim, 1)}s</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

export default ShotTable;
