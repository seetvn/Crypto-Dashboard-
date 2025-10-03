import React, { useEffect, useState, useRef } from "react";
import { Chart } from "chart.js/auto";

export default function LivePriceTrend({ symbol = "BTC" }) {
  const [status, setStatus] = useState("connecting...");
  const [latestPrice, setLatestPrice] = useState(null);
  const [latestTime, setLatestTime] = useState(null);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const API_BASE =import.meta.env.VITE_WS_BASE || "ws://localhost:8000";

  useEffect(() => {
    const ws = new WebSocket(`${API_BASE}/ws/prices/${symbol}/latest`);

    ws.onopen = () => setStatus("connected");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        setStatus(data.error);
        return;
      }

      const ts = new Date(data.timestamp).toLocaleTimeString();
      const price = data.price;

      // Update latest price info
      setLatestPrice(price);
      setLatestTime(ts);

      // Update chart
      const chart = chartInstanceRef.current;
      if (chart) {
        chart.data.labels.push(ts);
        chart.data.datasets[0].data.push(price);

        // keep last 100 points
        if (chart.data.labels.length > 100) {
          chart.data.labels.shift();
          chart.data.datasets[0].data.shift();
        }
        chart.update("none"); // fast update
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("disconnected");

    return () => ws.close();
  }, [symbol]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    // Init chart
    chartInstanceRef.current = new Chart(chartRef.current, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: `${symbol} Price (last 100 updates)`,
            data: [],
            borderColor: "green",
            backgroundColor: "rgba(0, 128, 0, 0.2)",
            fill: true,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: true, title: { display: true, text: "Time" } },
          y: { display: true, title: { display: true, text: "Price (USD)" } },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [symbol]);

  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "1rem",
        borderRadius: "8px",
        maxWidth: "400px",
      }}
    >
      <h3>{symbol} Live Price</h3>
      {latestPrice !== null ? (
        <div style={{ marginBottom: "0.5rem" }}>
          <p>
            <strong>Price:</strong> {latestPrice.toFixed(2)} USD(T)
          </p>
          <p>
            <strong>Time:</strong> {latestTime}
          </p>
        </div>
      ) : (
        <p>Waiting for updates…</p>
      )}

      <canvas
        ref={chartRef}
        width="350"
        height="200"
        style={{ border: "1px solid #eee", borderRadius: 6 }}
      />

      <small style={{ color: "gray" }}>Status: {status}</small>
    </div>
  );
}
