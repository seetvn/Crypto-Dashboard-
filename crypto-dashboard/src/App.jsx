import React from "react";
import Dashboard from "./dashboard";
import LivePrice from "./liveprice"; // use chart version instead of text

export default function App() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100vh",
      }}
    >
      {/* Left side = Dashboard */}
      <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
        <Dashboard />
      </div>

      {/* Right sidebar */}
      <div
        style={{
          width: "280px",
          borderLeft: "1px solid #ccc",
          padding: "1rem",
          overflowY: "auto",
        }}
      >
        <h3 style={{ marginBottom: "1rem" }}>Live Prices</h3>

        {/* BTC Widget */}
        <div style={{ marginBottom: "2rem" }}>
          <h4>BTC</h4>
          <LivePrice symbol="BTC" />
        </div>

        {/* ETH Widget */}
        <div>
          <h4>ETH</h4>
          <LivePrice symbol="ETH" />
        </div>
      </div>
    </div>
  );
}