// sizes in mm
export const TARGET_SIZE = 170.0;
export const PELLET_SIZE = 2.25;
export const SEVEN_RING_SIZE = 29.75;
export const TEN_RING_SIZE = 8.0;

const updateDirection = (shot: Shot) => {
  const angle = shot.angle + Math.PI;
  if (angle <= Math.PI / 8 || angle >= (15 * Math.PI) / 8) {
    shot.direction = "left";
  } else if (angle <= (3 * Math.PI) / 8 && angle >= Math.PI / 8) {
    shot.direction = "bottom_left";
  } else if (angle <= (5 * Math.PI) / 8 && angle >= (3 * Math.PI) / 8) {
    shot.direction = "bottom";
  } else if (angle <= (7 * Math.PI) / 8 && angle >= (5 * Math.PI) / 8) {
    shot.direction = "bottom_right";
  } else if (angle <= (9 * Math.PI) / 8 && angle >= (7 * Math.PI) / 8) {
    shot.direction = "right";
  } else if (angle <= (11 * Math.PI) / 8 && angle >= (9 * Math.PI) / 8) {
    shot.direction = "top_right";
  } else if (angle <= (13 * Math.PI) / 8 && angle >= (11 * Math.PI) / 8) {
    shot.direction = "top";
  } else {
    shot.direction = "top_left";
  }
};

const updateScoreStats = (beforeTrace: TracePoint[], shot: Shot) => {
  let entered10RingIdx = -1;
  let entered10RingTime = -1;
  let num10Ring = 0;
  const firstFrameTime = beforeTrace[0].time;
  const lastFrameTime = beforeTrace[beforeTrace.length - 1].time;

  for (let i = 0; i < beforeTrace.length; i++) {
    const currTP = beforeTrace[i];
    const currDist = Math.sqrt(currTP.x * currTP.x + currTP.y * currTP.y);

    if (currDist <= TEN_RING_SIZE) {
      // inside 10 ring
      if (entered10RingIdx == -1) {
        // first time inside ten ring
        entered10RingIdx = i;
        entered10RingTime = currTP.time;
      }

      num10Ring++;
    }
  }

  if (entered10RingIdx != -1) {
    const total10Ring = beforeTrace.length - entered10RingIdx + 1.0;
    // stability is how much you stay in the 10 ring since first entering it
    shot.stab = (num10Ring / total10Ring) * 100.0;

    // desc time is how long it took you to first enter the 10 ring
    shot.desc = (entered10RingTime - firstFrameTime) / 1000;

    // aim time is how long it took you to take the shot since first entering the 10 ring
    shot.aim = (lastFrameTime - entered10RingTime) / 1000;
  }
};

const updateScore = (shot: Shot) => {
  shot.score = 11 - Math.sqrt(shot.x * shot.x + shot.y * shot.y) / 8.0;

  // clip score to [0.0, 10.9]
  if (shot.score > 10.9) {
    shot.score = 10.9;
  }

  if (shot.score < 0.0) {
    shot.score = 0.0;
  }
};

const updatePolar = (shot: Shot) => {
  shot.r = Math.sqrt(shot.x * shot.x + shot.y * shot.y);
  shot.angle = Math.atan2(shot.y, shot.x);
  updateDirection(shot);
};

export const updateShot = (shot: Shot, beforeTrace: TracePoint[]) => {
  updateScore(shot);
  updatePolar(shot);
  updateScoreStats(beforeTrace, shot);
};

export const genRandomShots = (n: number): Shot[] => {
  const shots: Shot[] = [];
  for (let i = 0; i < n; i++) {
    // 50% of shots are inside circle
    const inside = Math.random() < 0.5;
    const range = inside ? SEVEN_RING_SIZE : TARGET_SIZE;
    const x = Math.random() * range - range / 2;
    const y = Math.random() * range - range / 2;
    const stab = Math.random() * 100;
    const desc = Math.random() * 100;
    const aim = Math.random() * 100;
    const shot = {
      id: i + 1,
      score: -1,
      x: x,
      y: y,
      r: -1,
      angle: -1,
      direction: "",
      stab: stab,
      desc: desc,
      aim: aim,
    };
    updateScore(shot);
    updatePolar(shot);

    shots.push(shot);
  }

  return shots;
};

export const toDP = (x: number, dp: number) => {
  const roundNum = Math.pow(10, dp);
  const numDP = (Math.round(x * roundNum) / roundNum).toFixed(dp);
  return numDP;
};

export interface Shot {
  id: number;
  score: number;
  x: number;
  y: number;
  r: number;
  angle: number;
  direction: string;
  stab: number;
  desc: number;
  aim: number;
}

export interface TracePoint {
  x: number;
  y: number;
  r: number;
  time: number;
}
