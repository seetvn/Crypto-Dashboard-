import { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js/auto";

export default function ChartComponent({ points }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [selected, setSelected] = useState(null); // { ts, price }
  console.log("There are", points.length," points");
  const timestamps = points.map((p) => p.close_time ?? p.open_time);
  const prices = points.map((p) => p.close);

  // Date only for axis
  const fmtDate = (ts) =>
    new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  // Full datetime for tooltip / click
  const fmtFull = (ts) =>
    new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const labels = timestamps.map((ts) => fmtDate(ts));

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Close Price (USDT)",
            data: prices,
            borderColor: "green",
            backgroundColor: "rgba(0, 128, 0, 0.2)", // semi-transparent green
            pointRadius: 2,
            pointHoverRadius: 4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return fmtFull(timestamps[idx]);
              },
              label: (item) => `Close: ${item.formattedValue}`,
            },
          },
        },
        scales: {
          x: { display: true, title: { display: true, text: "Date" } },
          y: { display: true, title: { display: true, text: "Price (USDT)" } },
        },
        onClick: (evt, elements) => {
          if (!elements?.length) return;
          const idx = elements[0].index;
          setSelected({ ts: timestamps[idx], price: prices[idx] });
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [points]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width="900"
        height="360"
        style={{ border: "1px solid #ccc", borderRadius: 8 }}
      />
      <div style={{ marginTop: 8, fontFamily: "system-ui, sans-serif" }}>
        {selected ? (
          <strong>
            {fmtFull(selected.ts)} — Close: {selected.price}
          </strong>
        ) : (
          <span style={{ opacity: 0.7 }}>
            Click a point to see exact time (HH:mm) and price
          </span>
        )}
      </div>
    </div>
  );
}
