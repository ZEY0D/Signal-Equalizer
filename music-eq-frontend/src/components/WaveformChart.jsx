// import React, { useEffect, useRef } from "react";
// import Chart from "chart.js/auto";

// export default function WaveformChart({ data }) {
//   const canvasRef = useRef(null);
//   const chartRef = useRef(null);

//   useEffect(() => {
//     if (!data || data.length === 0) return;

//     const ctx = canvasRef.current.getContext("2d");

//     // Destroy previous chart
//     if (chartRef.current) chartRef.current.destroy();

//     chartRef.current = new Chart(ctx, {
//       type: "line",
//       data: {
//         labels: data.map((_, i) => i),
//         datasets: [
//           {
//             label: "Waveform",
//             data,
//             borderColor: "cyan",
//             borderWidth: 1,
//             pointRadius: 0
//           }
//         ]
//       },
//       options: {
//         responsive: true,
//         maintainAspectRatio: false
//       }
//     });

//   }, [data]);

//   return (
//     <div style={{ height: "250px" }}>
//       <canvas ref={canvasRef} />
//     </div>
//   );
// }

import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function WaveformChart({ data }) {

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {

    if (!canvasRef.current) return;

    // 👉 Create chart ONCE
    if (!chartRef.current) {
      chartRef.current = new Chart(canvasRef.current.getContext("2d"), {
        type: "line",
        data: {
          labels: data.map((_, i) => i),
          datasets: [
            {
              label: "Waveform",
              data,
              borderColor: "cyan",
              borderWidth: 1,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false
        }
      });
    } else {
      // 👉 Update data ONLY (no recreation)
      chartRef.current.data.labels = data.map((_, i) => i);
      chartRef.current.data.datasets[0].data = data;
      chartRef.current.update("none"); // no animation, instant update
    }

  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%" }}
    ></canvas>
  );
}
