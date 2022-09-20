import { axisLeft, axisBottom, scaleLinear, select, line as d3Line } from "d3";
import { useEffect, useRef, useState } from "react";

const colors = ["#ff6e00", "#aacd00", "#0075e6", "#635273"];
// set margin around element to prevent clipping of axes
const MARGINS = {
  top: 30,
  right: 20,
  bottom: 30,
  left: 75,
};

const LineChart = ({
  lines,
  refLevel,
  xMin,
  xMax,
  yMin,
  yMax,
  xAxisLoc,
  yAxisLabel,
  name,
  zeroLine,
  aspectRatio,
  hasLegend,
  xAxisLabel
}: IProps) => {
  const svgElem = useRef<SVGSVGElement>(null);
  const [initialRender, setInitialRender] = useState(true);
  const [firstRender, setFirstRender] = useState(true);

  useEffect(() => {
    if (!svgElem.current) {
      return;
    }

    // init x and y range
    let minX = 0;
    if (xMin) {
      minX = xMin;
    }
    let maxX = 5;
    if (xMax) {
      maxX = xMax;
    }
    if (lines.length > 0) {
      const newMinX = lines[0][0].x;
      const newMaxX = lines[0][lines[0].length - 1].x;
      // only update range after first 5s of data is collected
      if (newMaxX > maxX) {
        minX = newMinX;
        maxX = newMaxX;
      }
    }
    let minY = 0;
    if (yMin) {
      minY = yMin;
    }
    let maxY = 1;
    if (yMax) {
      maxY = yMax;
    }

    // get element height and width
    const height = svgElem.current.clientHeight;
    const width = svgElem.current.clientWidth;

    // map x range and y range to width and height respectively
    const xScale = scaleLinear()
      .domain([minX, maxX])
      .range([MARGINS.left, width - MARGINS.right]);
    const yScale = scaleLinear()
      .domain([minY, maxY])
      .range([height - MARGINS.top, MARGINS.bottom]);

    if (initialRender) {
      // add placeholder for axes
      select(`.line-chart-${name}`)
        .append("g")
        .attr("class", `line-chart-${name}-yaxis`);
      select(`.line-chart-${name}`)
        .append("g")
        .attr("class", `line-chart-${name}-xaxis`);

      if (hasLegend) {
        // add legend
        select(`.line-chart-${name}`)
          .append("circle")
          .attr("transform", `translate(${width - MARGINS.left / 2}, 20)`)
          .attr("r", 6)
          .style("fill", colors[0])
        select(`.line-chart-${name}`)
          .append("text")
          .attr("transform", `translate(${width - MARGINS.left / 2 + 15}, 20)`)
          .text("x")
          .style("font-size", "15px")
          .style("fill", "white")
          .attr("alignment-baseline","middle")

        select(`.line-chart-${name}`)
          .append("circle")
          .attr("transform", `translate(${width - MARGINS.left / 2}, 40)`)
          .attr("r", 6)
          .style("fill", colors[1])
        select(`.line-chart-${name}`)
          .append("text")
          .attr("transform", `translate(${width - MARGINS.left / 2 + 15}, 40)`)
          .text("y")
          .style("font-size", "15px")
          .style("fill", "white")
          .attr("alignment-baseline","middle")
      }

      setInitialRender(false);
    }

    if (lines.length > 0 && firstRender) {
      // add placeholder for lines
      for (let i = 0; i < lines.length; i++) {
        select(`.line-chart-${name}`)
          .append("path")
          .attr("class", `line-chart-${name}-line-${i}`);
      }
      select(`.line-chart-${name}`)
        .append("path")
        .attr("class", `line-chart-${name}-ref-line`);

      setFirstRender(false);
    }

    // create axes
    const yAxis = axisLeft(yScale).ticks(5);
    const xAxis = axisBottom(xScale).ticks(5);

    // y-axis label
    let yAxisLabelStr = "Volume";
    if (yAxisLabel) {
      yAxisLabelStr = yAxisLabel;
    }
    select(`#y-axis-${name}-label`).remove();
    select(`.line-chart-${name}`)
      .append("g")
      .attr("id", `y-axis-${name}-label`)
      .attr("transform", `translate(${MARGINS.left - 30}, ${height / 2})`)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .style("fill", "white")
      .text(yAxisLabelStr);

    // x-axis label
    if (xAxisLabel) {
      select(`#x-axis-${name}-label`).remove();
      select(`.line-chart-${name}`)
        .append("g")
        .attr("id", `x-axis-${name}-label`)
        .attr("transform", `translate(${width - MARGINS.left / 2}, ${height - 20})`)
        .append("text")
        .attr("text-anchor", "middle")
        .style("fill", "white")
        .text(xAxisLabel);
    }

    // draw axes
    if (xAxisLoc && xAxisLoc == "middle") {
      select(`.line-chart-${name}-xaxis`)
        .attr("transform", `translate(0, ${height / 2})`)
        // @ts-expect-error: expect errors here due to inconsistencies in @types/d3
        .call(xAxis);
    } else {
      select(`.line-chart-${name}-xaxis`)
        .attr("transform", `translate(0, ${height - MARGINS.bottom})`)
        // @ts-expect-error: expect errors here due to inconsistencies in @types/d3
        .call(xAxis);
    }
    select(`.line-chart-${name}-yaxis`)
      .attr("transform", `translate(${MARGINS.left}, 0)`)
      // @ts-expect-error: expect errors here due to inconsistencies in @types/d3
      .call(yAxis);

    // draw line
    const line = d3Line()
      // @ts-expect-error: expect errors here due to inconsistencies in @types/d3
      .x((point) => xScale(point.x))
      // @ts-expect-error: expect errors here due to inconsistencies in @types/d3
      .y((point) => yScale(point.y));

    for (let i = 0; i < lines.length; i++) {
      select(`.line-chart-${name}-line-${i}`)
        // @ts-expect-error: expect errors here due to inconsistencies in @types/d3
        .attr("d", line(lines[i]))
        .attr("fill", "none")
        .attr("stroke", colors[i])
        .attr("stroke-width", 1.5);
    }

    // draw ref line
    if (refLevel != undefined && lines.length > 0) {
      const refLine = d3Line()
        // @ts-expect-error: expect errors here due to inconsistencies in @types/d3
        .x((point) => xScale(point.x))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .y((_) => yScale(refLevel));

      select(`.line-chart-${name}-ref-line`)
        // @ts-expect-error: expect errors here due to inconsistencies in @types/d3
        .attr("d", refLine(lines[0]))
        .attr("fill", "none")
        .attr("stroke", colors[lines.length])
        .attr("stroke-width", 1.5);
    }
  }, [lines, refLevel]);

  return (
    <svg
      ref={svgElem}
      className={`line-chart-${name}`}
      width="100%"
      style={aspectRatio ? { aspectRatio: aspectRatio  } : { width: "100%", height: "100%"}}
    >
      {zeroLine ? (
        <line
          x1="50%"
          y1="0%"
          x2="50%"
          y2="100%"
          stroke={colors[colors.length - 1]}
          transform={`translate(${(MARGINS.left - MARGINS.right) / 2}, 0)`}
        />
      ) : null}
    </svg>
  );
};

interface IProps {
  lines: { x: number; y: number }[][];
  refLevel?: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xAxisLoc?: string;
  yAxisLabel?: string;
  name: string;
  zeroLine?: boolean;
  aspectRatio?: string;
  hasLegend?: boolean;
  xAxisLabel?: string;
}

export default LineChart;
