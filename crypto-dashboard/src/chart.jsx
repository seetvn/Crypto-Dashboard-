import { useState } from "react";
import { Chart } from "chart.js/auto";

export default function ChartComponent() {
  const [chartRef, setChartRef] = useState(null);
  const [chartInstance, setChartInstance] = useState(null);

  return (
    <div>
       <canvas ref={setChartRef} width="900" height="360" style={{ border: "1px solid #ccc", borderRadius: 8 }} />
    </div>
  );
}