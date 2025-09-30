import React from "react";
import { useEffect, useRef} from "react";
import { Chart } from "chart.js/auto";
import PropTypes from "prop-types";  // 👈 import this

export default function ChartComponent({ points }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const selected = null;

  console.log("There are", points.length, "points");

  const timestamps = points.map((p) => p.close_time ?? p.open_time);
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
            label: "Close Price (USDT)",
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
  }, [points]);

  return (
    <div>
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

// ✅ declare prop types so ESLint shuts up
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
