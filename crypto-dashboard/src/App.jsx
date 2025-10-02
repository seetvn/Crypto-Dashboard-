import React from "react";
import Dashboard from "./dashboard";
import LivePrice from "./liveprice"; // chart version
import ProtocolHealthSearch from "./tvl";

export default function App() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Main content (Dashboard) */}
      <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
        <Dashboard />
      </div>

      {/* Right sidebar */}
      <div
        style={{
          width: "320px",
          borderLeft: "1px solid #ddd",
          padding: "1rem",
          overflowY: "auto",
          background: "#fafafa",
        }}
      >
        {/* Sidebar header */}
        <h2 style={{ marginBottom: "1.5rem", fontSize: "18px" }}>Widgets</h2>

        {/* Section wrapper style */}
        {[
          { title: "Protocol TVL Health", content: <ProtocolHealthSearch /> }, // ✅ moved to top
          { title: "BTC", content: <LivePrice symbol="BTC" /> },
          { title: "ETH", content: <LivePrice symbol="ETH" /> },
          { title: "cUSD", content: <LivePrice symbol="cUSD" /> },
        ].map((section, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: "1.5rem",
              padding: "1rem",
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <h3
              style={{
                marginBottom: "0.75rem",
                fontSize: "16px",
                borderBottom: "1px solid #eee",
                paddingBottom: "0.5rem",
              }}
            >
              {section.title}
            </h3>
            {section.content}
          </div>
        ))}
      </div>
    </div>
  );
}
