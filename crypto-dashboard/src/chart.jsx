import React, { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js/auto";
import PropTypes from "prop-types";

export default function ChartComponent({ points }) {
  /*
    Props:
      - points: array of {open_time, close_time, open, close
    State:
      - canvasRef: ref to the canvas element for Chart.js
      - chartRef: ref to the Chart.js instance
      - timeField: which time field to use for x-axis ("open_time" or "close_time")
      - selected: currently selected data point (for displaying exact time and price)
    
    displays a line chart of historical prices using Chart.js.
  */
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [timeField, setTimeField] = useState("close_time"); // 👈 default = close_time
  const selected = null;

  console.log("There are", points.length, "points");

  // choose which time field to use dynamically
  const timestamps = points.map((p) => p[timeField] ?? p.open_time);
  const prices = points.map((p) => p.close);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const labels = timestamps.map((ts) =>
      new Date(ts).toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    );

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `Price (using ${timeField})`,
            data: prices,
            borderColor: "green",
            backgroundColor: "rgba(0,128,0,0.2)",
            pointRadius: 2,
            pointHoverRadius: 4,
            fill: true,
          },
        ],
      },
    });
  }, [points, timeField]); // re-run when user changes field

  return (
    <div>
      {/*  selector for open_time / close_time */}
      <div style={{ marginBottom: "1rem" }}>
        <label>Choose time field: </label>
        <select
          value={timeField}
          onChange={(e) => setTimeField(e.target.value)}
        >
          <option value="close_time">Close Time</option>
          <option value="open_time">Open Time</option>
        </select>
      </div>

      <canvas
        ref={canvasRef}
        width="900"
        height="360"
        style={{ border: "1px solid #ccc", borderRadius: 8 }}
      />

      <div>
        {selected ? (
          <strong>
            {new Date(selected.ts).toLocaleString()} — Close: {selected.price}
          </strong>
        ) : (
          <span style={{ opacity: 0.7 }}>
            Click a point to see exact time and price
          </span>
        )}
      </div>
    </div>
  );
}

// declare prop types
ChartComponent.propTypes = {
  points: PropTypes.arrayOf(
    PropTypes.shape({
      open_time: PropTypes.number,
      close_time: PropTypes.number,
      open: PropTypes.number,
      close: PropTypes.number,
    })
  ).isRequired,
};
