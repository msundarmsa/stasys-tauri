import { Fragment } from "react";
import { CardContent, Typography, Card } from "@mui/material";
import { toDP } from "../../ShotUtils";

const ScoreStatCard = ({ scoreStatType, scoreStat, dp, suffix }: IProps) => (
  <Card variant="outlined" style={{ flex: 1, margin: "5px" }}>
    <Fragment>
      <CardContent>
        <Typography variant="button" gutterBottom>
          {scoreStatType}
        </Typography>
        <Typography variant="h1" component="div" fontSize={50}>
          { scoreStat <= 0 ?
            "-" :
            `${toDP(scoreStat, dp)}${suffix}`
          }
        </Typography>
      </CardContent>
    </Fragment>
  </Card>
);

interface IProps {
  scoreStatType: string;
  scoreStat: number;
  dp: number;
  suffix: string;
}

export default ScoreStatCard;
