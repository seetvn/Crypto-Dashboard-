import React, { useState } from "react";
import ChartComponent from "./chart";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
//TODO: adjust interval according to range
//TODO: add more data to chart (e.g., close, indicators, etc)
//TODO: better error handling (e.g., network errors)
// cUSD only supports year 2021
const CUSD_MIN = "2021-01-01T00:00";
const CUSD_MAX = "2021-12-31T23:59";

export default function Dashboard() {
  const [symbol, setSymbol] = useState("BTC");
  const [interval, setInterval] = useState("1h");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

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
    if (symbol === "cUSD") {
      const min = new Date(CUSD_MIN).getTime();
      const max = new Date(CUSD_MAX).getTime();
      if (startMs < min || endMs > max) {
        setError("cUSD data only available for year 2021.");
        return;
      }
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
      setShowRaw(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 980, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: "1rem" }}>Crypto Dashboard (Client)</h1>

      {/* Form */}
      <form
        onSubmit={fetchData}
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(6, 1fr)",
          alignItems: "end",
        }}
      >
        {/* Currency */}
        <div>
          <label>Currency</label>
          <br />
          <select
            value={symbol}
            onChange={(e) => {
              const val = e.target.value;
              setSymbol(val);
              if (val === "cUSD") {
                setStart(CUSD_MIN);
                setEnd(CUSD_MAX);
              }
            }}
          >
            <option>BTC</option>
            <option>ETH</option>
            <option>cUSD</option>
          </select>
        </div>

        {/* Interval */}
        <div>
          <label>Interval</label>
          <br />
          <select value={interval} onChange={(e) => setInterval(e.target.value)}>
            {[
              "1m","5m","15m","30m","1h","2h","4h","6h",
              "8h","12h","1d","3d","1w","1M"
            ].map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        {/* Start */}
        <div style={{ gridColumn: "span 2" }}>
          <label>Start (UTC)</label>
          <br />
          <input
            type="datetime-local"
            value={start}
            min={symbol === "cUSD" ? CUSD_MIN : undefined}
            max={symbol === "cUSD" ? CUSD_MAX : new Date().toISOString().slice(0, 16)}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>

        {/* End */}
        <div style={{ gridColumn: "span 2" }}>
          <label>End (UTC)</label>
          <br />
          <input
            type="datetime-local"
            value={end}
            min={symbol === "cUSD" ? CUSD_MIN : undefined}
            max={symbol === "cUSD" ? CUSD_MAX : new Date().toISOString().slice(0, 16)}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>

        {/* Fetch button */}
        <div>
          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Fetch"}
          </button>
        </div>
      </form>

      {/* Raw API Response toggle */}
      <div style={{ marginTop: "1.5rem" }}>
        <h3>
          <button
            onClick={() => setShowRaw(!showRaw)}
            style={{
              background: "none",
              border: "none",
              color: "#0070f3",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "1rem",
              padding: 0,
            }}
          >
            {showRaw ? "Hide Raw API Response" : "Show Raw API Response"}
          </button>
        </h3>

        {error && (
          <div style={{ color: "crimson", marginBottom: ".5rem" }}>
            Error: {error}
          </div>
        )}
        {loading && <div>Loading…</div>}
        {!loading && resp && showRaw && (
          <pre
            style={{
              background: "#1111",
              padding: "1rem",
              borderRadius: 8,
              overflow: "auto",
              maxHeight: 380,
            }}
          >
            {JSON.stringify(resp, null, 2)}
          </pre>
        )}
      </div>

      {/* Chart */}
      <div style={{ marginTop: "1.5rem" }}>
        <h3>Chart</h3>
        {resp && <ChartComponent points={resp.points} />}
      </div>

      <p style={{ opacity: 0.7, marginTop: "1rem" }}>
        Backend base URL: <code>{API_BASE}</code> (override with{" "}
        <code>VITE_API_BASE</code>)
      </p>
    </div>
  );
}
