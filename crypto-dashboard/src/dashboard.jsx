import React, { useState, useEffect } from "react";
import ChartComponent from "./chart";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
// cUSD only supports year 2021 onwards
const CUSD_MIN = "2021-01-01T00:00";

// --- NEW: Interval limits ---
const INTERVAL_LIMITS = {
  "1m": 1000 * 60 * 60 * 24 * 7,        // up to 7 days
  "5m": 1000 * 60 * 60 * 24 * 30,       // up to 30 days
  "15m": 1000 * 60 * 60 * 24 * 90,      // up to 3 months
  "30m": 1000 * 60 * 60 * 24 * 180,     // up to 6 months
  "1h": 1000 * 60 * 60 * 24 * 365,      // up to 1 year
  "2h": 1000 * 60 * 60 * 24 * 365,
  "4h": 1000 * 60 * 60 * 24 * 2 * 365,  // up to 2 years
  "6h": 1000 * 60 * 60 * 24 * 2 * 365,
  "8h": 1000 * 60 * 60 * 24 * 2 * 365,
  "12h": 1000 * 60 * 60 * 24 * 3 * 365, // up to 3 years
  "1d": Infinity,
  "3d": Infinity,
  "1w": Infinity,
  "1M": Infinity,
};

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

  // --- NEW: compute allowed intervals dynamically ---
  const startMs = toMs(start);
  const endMs = toMs(end);
  const rangeMs = startMs && endMs ? endMs - startMs : null;

  const availableIntervals = Object.keys(INTERVAL_LIMITS).filter(
    (i) => !rangeMs || rangeMs <= INTERVAL_LIMITS[i]
  );

  // Auto-correct interval if it's not valid anymore
  useEffect(() => {
    if (interval && !availableIntervals.includes(interval)) {
      setInterval(availableIntervals[availableIntervals.length - 1]); // fallback to largest allowed
    }
  }, [rangeMs]);

  const fetchData = async (e) => {
    e.preventDefault();
    setError(null);
    setResp(null);

    if (!startMs || !endMs || endMs <= startMs) {
      setError("Please pick valid start/end datetimes (end > start).");
      return;
    }
    if (symbol === "cUSD") {
      const min = new Date(CUSD_MIN).getTime();
      const max = Date.now();
      if (startMs < min || endMs > max) {
        setError("cUSD data only available from 2021 onwards.");
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
      <h1 style={{ marginBottom: "1rem" }}>My Dashboard</h1>

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
                setEnd(new Date().toISOString().slice(0, 16));
              }
            }}
          >
            <option>BTC</option>
            <option>ETH</option>
            <option>cUSD</option>
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
            max={new Date().toISOString().slice(0, 16)}
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
            max={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>

        {/* Interval */}
        <div>
          <label>Interval</label>
          <br />
          <select value={interval} onChange={(e) => setInterval(e.target.value)}>
            {availableIntervals.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
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
