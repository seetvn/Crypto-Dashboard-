import React from "react";
import { useState } from "react";
import ChartComponent from "./chart";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

//TODO: adjust interval according to range
//TODO: add more data to chart (e.g., close, indicators, etc)
//TODO: better error handling (e.g., network errors)
export default function Dashboard() {
  const [symbol, setSymbol] = useState("BTC");
  const [interval, setInterval] = useState("1h");
  const [start, setStart] = useState(""); // HTML datetime-local string
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState(null);

  // Convert datetime-local string to UNIX ms
  const toMs = (v) => (v ? new Date(v).getTime() : null);

  const fetchData = async (e) => {
    e.preventDefault();
    setError(null);
    setResp(null);

    const startMs = toMs(start);
    const endMs = toMs(end);

    if (!startMs || !endMs || endMs <= startMs) {
      setError("Please pick valid start/end datetimes (end > start).");
      return;
    }

    const url = new URL(`${API_BASE}/prices/${symbol}`);
    url.searchParams.set("startTime", String(startMs));
    url.searchParams.set("endTime", String(endMs));
    url.searchParams.set("interval", interval);

    try {
  setLoading(true);
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${r.status}`);
  }
  const data = await r.json();
  setResp(data);

  // log top-level keys
  console.log("Top-level keys:", Object.keys(data));

  // if it has `points` array, log its keys too
  if (Array.isArray(data.points) && data.points.length > 0) {
    console.log("Keys inside points[0]:", Object.keys(data.points[0]));
  }

} catch (err) {
  setError(err.message);
} finally {
  setLoading(false);
}

  };

  return (
    <div style={{ maxWidth: 980, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: "1rem" }}>Crypto Dashboard (Client)</h1>

      <form onSubmit={fetchData} style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(6, 1fr)", alignItems: "end" }}>
        <div>
          <label>Currency</label><br />
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            <option>BTC</option>
            <option>ETH</option>
          </select>
        </div>
        <div>
          <label>Interval</label><br />
          <select value={interval} onChange={(e) => setInterval(e.target.value)}>
            {["1m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w","1M"].map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label>Start (UTC)</label><br />
          <input
            type="datetime-local"
            value={start}
            max = {new Date().toISOString().slice(0,16)}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label>End (UTC)</label><br />
          <input
            type="datetime-local"
            value={end}
            max = {new Date().toISOString().slice(0,16)}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div>
          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Fetch"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: "1.5rem" }}>
        <h3>Raw API Response</h3>
        {error && <div style={{ color: "crimson", marginBottom: ".5rem" }}>Error: {error}</div>}
        {loading && <div>Loading…</div>}
        {!loading && resp && (
          <pre style={{ background: "#1111", padding: "1rem", borderRadius: 8, overflow: "auto", maxHeight: 380 }}>
{JSON.stringify(resp, null, 2)}
          </pre>
        )}
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <h3>Chart </h3>
      {resp && <ChartComponent points={resp.points} />}
      </div>

      <p style={{ opacity: .7, marginTop: "1rem" }}>
        Backend base URL: <code>{API_BASE}</code> (override with <code>VITE_API_BASE</code>)
      </p>
    </div>
  );
}
