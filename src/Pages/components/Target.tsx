import { useEffect, useState } from "react";
import {
  PELLET_SIZE,
  SEVEN_RING_SIZE,
  Shot,
  TARGET_SIZE,
} from "../../ShotUtils";

const circles = [
  { radius: 311 / 680, fill: "#121212", border: "#D7EC58" },
  { radius: 279 / 680, fill: "#121212", border: "#D7EC58" },
  { radius: 247 / 680, fill: "#121212", border: "#D7EC58" },
  { radius: 43 / 136, fill: "#121212", border: "#D7EC58" },
  { radius: 183 / 680, fill: "#121212", border: "#D7EC58" },
  { radius: 151 / 680, fill: "#121212", border: "#D7EC58" },
  { radius: 7 / 40, fill: "#D7EC58", border: "" },
  { radius: 87 / 680, fill: "#D7EC59", border: "#121212" },
  { radius: 11 / 136, fill: "#D7EC60", border: "#121212" },
  { radius: 23 / 680, fill: "#D7EC61", border: "#121212" },
  { radius: 1 / 68, fill: "#D7EC62", border: "#121212" },
];

const circleNumbers = [
  { text: "1", x: 1 / 2, y: 127 / 136, color: "#D7EC58" },
  { text: "1", x: 1 / 2, y: 9 / 136, color: "#D7EC58" },
  { text: "1", x: 127 / 136, y: 1 / 2, color: "#D7EC58" },
  { text: "1", x: 9 / 136, y: 1 / 2, color: "#D7EC58" },
  { text: "2", x: 1 / 2, y: 603 / 680, color: "#D7EC58" },
  { text: "2", x: 1 / 2, y: 77 / 680, color: "#D7EC58" },
  { text: "2", x: 603 / 680, y: 1 / 2, color: "#D7EC58" },
  { text: "2", x: 77 / 680, y: 1 / 2, color: "#D7EC58" },
  { text: "3", x: 1 / 2, y: 571 / 680, color: "#D7EC58" },
  { text: "3", x: 1 / 2, y: 109 / 680, color: "#D7EC58" },
  { text: "3", x: 571 / 680, y: 1 / 2, color: "#D7EC58" },
  { text: "3", x: 109 / 680, y: 1 / 2, color: "#D7EC58" },
  { text: "4", x: 1 / 2, y: 539 / 680, color: "#D7EC58" },
  { text: "4", x: 1 / 2, y: 141 / 680, color: "#D7EC58" },
  { text: "4", x: 539 / 680, y: 1 / 2, color: "#D7EC58" },
  { text: "4", x: 141 / 680, y: 1 / 2, color: "#D7EC58" },
  { text: "5", x: 1 / 2, y: 507 / 680, color: "#D7EC58" },
  { text: "5", x: 1 / 2, y: 173 / 680, color: "#D7EC58" },
  { text: "5", x: 507 / 680, y: 1 / 2, color: "#D7EC58" },
  { text: "5", x: 173 / 680, y: 1 / 2, color: "#D7EC58" },
  { text: "6", x: 1 / 2, y: 95 / 136, color: "#D7EC58" },
  { text: "6", x: 1 / 2, y: 41 / 136, color: "#D7EC58" },
  { text: "6", x: 95 / 136, y: 1 / 2, color: "#D7EC58" },
  { text: "6", x: 41 / 136, y: 1 / 2, color: "#D7EC58" },
  { text: "7", x: 1 / 2, y: 443 / 680, color: "#464646" },
  { text: "7", x: 1 / 2, y: 237 / 680, color: "#464646" },
  { text: "7", x: 443 / 680, y: 1 / 2, color: "#464646" },
  { text: "7", x: 237 / 680, y: 1 / 2, color: "#464646" },
  { text: "8", x: 1 / 2, y: 411 / 680, color: "#464646" },
  { text: "8", x: 1 / 2, y: 269 / 680, color: "#464646" },
  { text: "8", x: 411 / 680, y: 1 / 2, color: "#464646" },
  { text: "8", x: 269 / 680, y: 1 / 2, color: "#464646" },
];

export const Target = ({
  shots,
  shotPoint,
  prevBefore,
  prevAfter,
  setPrevBefore,
  setPrevAfter,
  newBefore,
  newAfter,
  canvasRef,
  handleFineAdjustmentStart,
  handleFineAdjustmentMove,
  handleFineAdjustmentEnd,
  fineAdjustmentEnd: fineAdjustment,
  fineAdjustmentStart,
  showAdjustment,
}: {
  shots: Shot[];
  shotPoint: [number, number] | undefined;
  prevBefore: [number, number] | undefined;
  prevAfter: [number, number] | undefined;
  setPrevBefore: (trace: [number, number] | undefined) => void;
  setPrevAfter: (trace: [number, number] | undefined) => void;
  newBefore: [number, number] | undefined;
  newAfter: [number, number] | undefined;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  handleFineAdjustmentStart: (e: React.MouseEvent<SVGCircleElement>) => void;
  handleFineAdjustmentMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleFineAdjustmentEnd: (e: React.MouseEvent<SVGSVGElement>) => void;
  fineAdjustmentEnd: number[];
  fineAdjustmentStart: number[];
  showAdjustment: boolean;
}) => {
  const translateX = (x: number): number => {
    return ((x + TARGET_SIZE / 2) / TARGET_SIZE) * 100;
  };
  const translateY = (y: number): number => {
    return ((TARGET_SIZE / 2 - y) / TARGET_SIZE) * 100;
  };

  const translateAndScaleTracePoint = (
    point: [number, number],
    canvas: HTMLCanvasElement
  ): [number, number] => {
    const newX = (translateX(point[0]) / 100) * canvas.width;
    const newY = (translateY(point[1]) / 100) * canvas.height;

    return [newX, newY];
  };

  const fixDPI = (canvas: HTMLCanvasElement) => {
    const dpi = window.devicePixelRatio;
    const newHeight =
      parseInt(getComputedStyle(canvas).getPropertyValue("height")) * dpi;
    const newWidth =
      parseInt(getComputedStyle(canvas).getPropertyValue("width")) * dpi;
    canvas.setAttribute("height", newHeight.toString());
    canvas.setAttribute("width", newWidth.toString());
  };

  const updateTrace = (before: boolean) => {
    let newTrace = before ? newBefore : newAfter;
    const prevTrace = before ? prevBefore : prevAfter;
    if (!newTrace || !canvasRef.current) {
      return;
    }

    newTrace = translateAndScaleTracePoint(newTrace, canvasRef.current);

    if (!prevTrace) {
      if (before) {
        setPrevBefore(newTrace);
      } else {
        setPrevAfter(newTrace);
      }
      return;
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.strokeStyle = before ? "#10e2e6" : "#DF2935";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(prevTrace[0], prevTrace[1]);
    ctx.lineTo(newTrace[0], newTrace[1]);
    ctx.stroke();
    ctx.closePath();

    if (before) {
      setPrevBefore(newTrace);
    } else {
      setPrevAfter(newTrace);
    }
  };

  useEffect(() => {
    if (canvasRef.current) {
      fixDPI(canvasRef.current);
    }
  }, []);

  useEffect(() => {
    updateTrace(true);
  }, [newBefore]);

  useEffect(() => {
    updateTrace(false);
  }, [newAfter]);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative", width: "100%", maxHeight: "100%", aspectRatio: "1/1", overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          style={{
            left: 0,
            top: 0,
            zIndex: 3,
            position: "absolute",
            width: "100%",
            aspectRatio: "1/1"
          }}
        ></canvas>
        <svg
          style={{
            left: 0,
            top: 0,
            zIndex: 3,
            position: "absolute",
            width: "100%",
            aspectRatio: "1/1"
          }}
          onMouseMove={handleFineAdjustmentMove}
          onMouseUp={handleFineAdjustmentEnd}
        >
          {shots.map((shot, _) => {
            return (
              <circle
                cx={`${translateX(shot.x)}%`}
                cy={`${translateY(shot.y)}%`}
                fill="#000000"
                r={`${(PELLET_SIZE / TARGET_SIZE) * 100}%`}
                stroke="#ffffff"
                strokeWidth={3}
                onMouseDown={handleFineAdjustmentStart}
              />
            );
          })}
          {shotPoint ? (
            <circle
              cx={`${translateX(shotPoint[0])}%`}
              cy={`${translateY(shotPoint[1])}%`}
              fill="#ff1493"
              r={`${(PELLET_SIZE / TARGET_SIZE) * 100}%`}
              stroke="#ffffff"
              strokeWidth={3}
              onMouseDown={handleFineAdjustmentStart}
            />
          ) : null}
          <defs>
            <marker id="arrowhead" viewBox="0 0 10 10"
                  refX="10" refY="5"
                  markerUnits="strokeWidth"
                  markerWidth="10" markerHeight="10"
                  orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#fff"/>
            </marker>
          </defs>
          { showAdjustment ? (
              <circle
                cx={fineAdjustment[0]}
                cy={fineAdjustment[1]}
                fill="#00000000"
                r={`${(PELLET_SIZE / TARGET_SIZE) * 100 + 0.2}%`}
                stroke="#ffffff"
                strokeWidth={2}
                strokeDasharray="5"
              /> )  :
              null
          }
          { showAdjustment ? (
              <line x1={fineAdjustmentStart[0]} y1={fineAdjustmentStart[1]} x2={fineAdjustment[0]} y2={fineAdjustment[1]} stroke="#fff"
              stroke-width="2" marker-end="url(#arrowhead)" /> )  :
              null
          }
        </svg>
        <svg style={{ height: "100%", width: "100%", aspectRatio: "1/1" }}>
          {circles.map((circle, _) => {
            return (
              <circle
                cx="50%"
                cy="50%"
                r={`${circle.radius * 100}%`}
                fill={circle.fill}
                stroke={circle.border}
              />
            );
          })}
          {circleNumbers.map((circleNum, _) => {
            return (
              <text
                x={`${circleNum.x * 100}%`}
                y={`${circleNum.y * 100}%`}
                fill={circleNum.color}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {circleNum.text}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export const ZoomedTarget = ({ shots }: { shots: Shot[] }) => {
  const startIndex = 6;
  const shotSize = (PELLET_SIZE / 29.75) * 50;

  const transformShot = (
    shot: Shot
  ): { inside: boolean; x: number; y: number; angle: number } => {
    const inside = shot.r <= 29.75;
    const r = inside ? shot.r : 25.75;
    const rX = r * Math.cos(shot.angle);
    const rY = r * Math.sin(shot.angle);

    const cX = ((rX + SEVEN_RING_SIZE) / (2 * SEVEN_RING_SIZE)) * 100;
    const cY = ((SEVEN_RING_SIZE - rY) / (2 * SEVEN_RING_SIZE)) * 100;
    return {
      inside: inside,
      x: cX,
      y: cY,
      angle: ((Math.PI / 2 - shot.angle) * 180) / Math.PI,
    };
  };

  return (
    <svg style={{ height: "100%", width: "100%", aspectRatio: "1/1" }}>
      {circles.map((circle, i) => {
        return i >= startIndex ? (
          <circle
            cx="50%"
            cy="50%"
            r={`${(circle.radius * 50) / circles[startIndex].radius}%`}
            fill={circle.fill}
            stroke={circle.border}
          />
        ) : null;
      })}
      {shots
        .map((shot, _) => transformShot(shot))
        .map((plot, _) => {
          return plot.inside ? (
            <circle
              cx={`${plot.x}%`}
              cy={`${plot.y}%`}
              fill="#000000"
              r={`${shotSize}%`}
              stroke="#ffffff"
              strokeWidth={3}
            />
          ) : (
            <g
              transform={`rotate(${plot.angle})`}
              style={{ transformOrigin: "center", transformBox: "fill-box" }}
            >
              {" "}
              <svg
                id="triangle"
                viewBox="0 0 100 100"
                height={`${2 * shotSize}%`}
                width={`${2 * shotSize}%`}
                x={`${plot.x - shotSize}%`}
                y={`${plot.y - shotSize}%`}
              >
                {" "}
                <polygon
                  x="-50%"
                  y="-50%"
                  points="0 100, 50 0, 100 100"
                  fill="#DF2935"
                  strokeWidth={3}
                  stroke="#ffffff"
                />{" "}
              </svg>{" "}
            </g>
          );
        })}
    </svg>
  );
};
