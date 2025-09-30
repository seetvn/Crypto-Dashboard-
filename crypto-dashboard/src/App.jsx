import { useState } from "react";
import { Chart } from "chart.js/auto";
import Dashboard from "./dashboard";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function App() {
  return <div> <Dashboard /></div>;
}
 