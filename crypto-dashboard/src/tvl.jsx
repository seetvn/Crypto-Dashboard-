import React, { useState } from "react";

const API_BASE =import.meta.env.VITE_API_BASE ||
  `http://${window.location.hostname}:8000`;

export default function ProtocolHealthSearch() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Format big numbers nicely ($105.6B style)
  const formatNumber = (num) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(num);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`${API_BASE}/tvl/${query}/health`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({})); // handle invalid JSON
        throw new Error(`Error: ${res.status} Could not find protocol "${query}". ${errorData.detail || ""}`);
  }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "auto" }}>
      <form onSubmit={handleSearch} style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Enter protocol (e.g. aave)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: "8px", width: "70%", marginRight: "10px" }}
        />
        <button type="submit" style={{ padding: "8px 16px" }}>
          Search
        </button>
      </form>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {data && (
        <div style={{ textAlign: "left" }}>
          <h3>Protocol: ${data.protocol}</h3>
          <p>Total TVL: {formatNumber(data.total_tvl)}</p>
          <h4>Chains:</h4>
          <ul>
            {Array.isArray(data.chains) &&
              (showAll ? data.chains : data.chains.slice(0, 10)).map(
                ([chain, value], idx) => (
                  <li key={idx}>
                    {chain} - {formatNumber(value)}
                  </li>
                )
              )}
          </ul>
          {Array.isArray(data.chains) && data.chains.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              style={{
                marginTop: "0.5rem",
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              {showAll ? "Show Less" : "Show More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
