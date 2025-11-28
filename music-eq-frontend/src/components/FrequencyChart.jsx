// import React, { useEffect, useRef, useState } from "react";
// import Chart from "chart.js/auto";

// export default function FrequencyChart({ data }) {
//   const chartRef = useRef(null);
//   const canvasRef = useRef(null);
  
//   // State to toggle between Linear and Audiogram (Logarithmic)
//   const [useAudiogramScale, setUseAudiogramScale] = useState(false);

//   useEffect(() => {
//     if (!canvasRef.current || !data || data.length === 0) return;

//     // 1. Prepare Data
//     // For Logarithmic scale, X values cannot be 0. We filter out DC component (0Hz) if needed.
//     const cleanData = data.filter(d => d.f > 0);
    
//     const labels = cleanData.map(d => d.f);
//     const values = cleanData.map(d => d.m);

//     // 2. Configure Scales
//     const xScaleConfig = useAudiogramScale
//       ? {
//           type: "logarithmic",
//           title: { display: true, text: "Frequency (Hz) - Audiogram Scale" },
//           min: 20,    // Standard hearing range start
//           max: 20000, // Standard hearing range end
//         }
//       : {
//           type: "linear",
//           title: { display: true, text: "Frequency (Hz) - Linear Scale" },
//         };

//     // 3. Create or Update Chart
//     if (!chartRef.current) {
//       chartRef.current = new Chart(canvasRef.current, {
//         type: "line",
//         data: {
//           labels: labels,
//           datasets: [
//             {
//               label: "Magnitude (dB)",
//               data: values,
//               borderColor: "#ff5733",
//               borderWidth: 1,
//               pointRadius: 0,
//               fill: true,
//               backgroundColor: "rgba(255, 87, 51, 0.2)"
//             }
//           ]
//         },
//         options: {
//           responsive: true,
//           maintainAspectRatio: false,
//           animation: false,
//           interaction: {
//             mode: 'index',
//             intersect: false,
//           },
//           scales: {
//             x: xScaleConfig,
//             y: {
//               title: { display: true, text: "Magnitude" },
//               beginAtZero: true
//             }
//           },
//           plugins: {
//             legend: { display: false }
//           }
//         }
//       });
//     } else {
//       // Update Data
//       chartRef.current.data.labels = labels;
//       chartRef.current.data.datasets[0].data = values;
      
//       // Update Scale Type dynamically
//       chartRef.current.options.scales.x = xScaleConfig;
      
//       chartRef.current.update("none");
//     }
//   }, [data, useAudiogramScale]);

//   return (
//     <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
      
//       {/* Toggle Button in Top-Right Corner */}
//       <div style={{ position: "absolute", top: "10px", right: "10px", zIndex: 10 }}>
//         <button
//           onClick={() => setUseAudiogramScale(!useAudiogramScale)}
//           style={{
//             background: "#333",
//             color: "white",
//             border: "1px solid #555",
//             padding: "5px 10px",
//             borderRadius: "4px",
//             cursor: "pointer",
//             fontSize: "0.8rem"
//           }}
//         >
//           Scale: {useAudiogramScale ? "Audiogram (Log)" : "Linear"}
//         </button>
//       </div>

//       <canvas ref={canvasRef} />
//     </div>
//   );
// }
import React, { useRef, useEffect, useCallback } from 'react';

// Placeholder component for the Frequency Domain (FFT) visualization.
const FrequencyChart = ({ data, type }) => {
    const canvasRef = useRef(null);
    const [currentScale, setCurrentScale] = React.useState('linear'); 

    const drawChart = useCallback((canvas, data, scale) => {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        
        if (!data || data.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`No ${type} FFT Data Loaded`, width / 2, height / 2);
            return;
        }

        // Audiogram scale parameters (20Hz to 20kHz)
        const minFreq = 20;
        const maxFreq = 20000;
        const logMinFreq = Math.log10(minFreq);
        const logMaxFreq = Math.log10(maxFreq);
        
        // Y-axis parameters for audiogram (dB scale, inverted)
        const minDB = -10;  // Top of audiogram (good hearing)
        const maxDB = 120;  // Bottom of audiogram (severe hearing loss)
        const dbRange = maxDB - minDB;
        
        // Find maximum value for normalization (linear mode)
        let maxDataValue = 0;
        if (data.length > 0) {
            maxDataValue = data.reduce((max, val) => Math.max(max, val), 0);
        }
        
        const dataLength = data.length;
        
        // Margins for audiogram grid
        const marginLeft = 40;
        const marginRight = 10;
        const marginTop = 30;
        const marginBottom = 30;
        const plotWidth = width - marginLeft - marginRight;
        const plotHeight = height - marginTop - marginBottom;
        
        // Draw Y-axis grid and labels for audiogram
        if (scale === 'audiogram') {
            ctx.strokeStyle = '#333';
            ctx.fillStyle = '#888';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.lineWidth = 0.5;
            
            // Draw horizontal grid lines and dB labels
            const dbSteps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
            dbSteps.forEach(db => {
                const yPos = marginTop + ((db - minDB) / dbRange) * plotHeight;
                ctx.fillText(`${db} dB`, marginLeft - 5, yPos + 3);
                ctx.beginPath();
                ctx.moveTo(marginLeft, yPos);
                ctx.lineTo(marginLeft + plotWidth, yPos);
                ctx.stroke();
            });
            
            // Draw Y-axis label
            ctx.save();
            ctx.translate(15, height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ccc';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('Hearing Level (dB HL)', 0, 0);
            ctx.restore();
        }

        ctx.strokeStyle = type === 'input' ? '#4A90E2' : '#F5A623';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        let started = false;
        
        // Draw the frequency spectrum
        for (let i = 0; i < dataLength; i++) {
            let x, y;
            
            if (scale === 'audiogram') {
                // Calculate frequency for this bin
                const freq = (i / dataLength) * 22050; // Approximate Nyquist frequency
                
                // Skip DC component and frequencies below minFreq
                if (freq < minFreq) {
                    continue;
                }
                
                // Logarithmic mapping for audiogram scale (X-axis)
                const clampedFreq = Math.min(Math.max(freq, minFreq), maxFreq);
                const logFreq = Math.log10(clampedFreq);
                const normalizedLogPos = (logFreq - logMinFreq) / (logMaxFreq - logMinFreq);
                x = marginLeft + normalizedLogPos * plotWidth;
                
                // Convert magnitude to dB for Y-axis
                const magnitudeDB = data[i] > 0 ? 20 * Math.log10(data[i]) : -100;
                
                // Normalize dB to audiogram range (inverted: higher dB = lower on chart)
                // Map magnitude dB to hearing level dB (normalize based on max magnitude)
                const maxMagnitudeDB = maxDataValue > 0 ? 20 * Math.log10(maxDataValue) : 0;
                const normalizedDB = maxMagnitudeDB - magnitudeDB; // Invert: louder = less hearing loss
                const clampedDB = Math.min(Math.max(normalizedDB, minDB), maxDB);
                const dbPos = (clampedDB - minDB) / dbRange;
                y = marginTop + dbPos * plotHeight;
                
            } else {
                // Linear scale (X-axis)
                x = (i / dataLength) * width;
                
                // Linear magnitude (Y-axis)
                let normalizedMag = data[i] / maxDataValue;
                y = height - (normalizedMag * height * 0.8); 
            }
            
            if (!started) {
                if (scale === 'audiogram') {
                    ctx.moveTo(x, y);
                } else {
                    ctx.moveTo(x, height);
                }
                started = true;
            }
            ctx.lineTo(x, y);
        }
        
        if (scale === 'audiogram') {
            // Don't fill to bottom in audiogram mode
            ctx.stroke();
        } else {
            // Fill to bottom in linear mode
            ctx.lineTo(width, height);
            ctx.closePath();
            ctx.fillStyle = type === 'input' ? 'rgba(74, 144, 226, 0.4)' : 'rgba(245, 166, 35, 0.4)'; 
            ctx.fill();
            ctx.stroke();
        }

        // Draw frequency grid labels for audiogram scale
        if (scale === 'audiogram') {
            ctx.fillStyle = '#888';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            const freqLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
            freqLabels.forEach(freq => {
                const logFreq = Math.log10(freq);
                const normalizedLogPos = (logFreq - logMinFreq) / (logMaxFreq - logMinFreq);
                const x = marginLeft + normalizedLogPos * plotWidth;
                ctx.fillText(freq >= 1000 ? `${freq/1000}k` : freq, x, height - 10);
            });
            
            // X-axis label
            ctx.fillStyle = '#ccc';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('Frequency (Hz)', width / 2, height - marginBottom + 25);
        }

        // Label the type
        ctx.fillStyle = '#ccc';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${type.toUpperCase()} Spectrum - ${scale === 'audiogram' ? 'Audiogram (Log)' : 'Linear'}`, 10, 20);

    }, [type]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // Make the canvas responsive
        const rect = canvas.parentNode.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height - 30;
        drawChart(canvas, data, currentScale);
    }, [data, currentScale, drawChart]);
    
    const containerStyle = {
        flexGrow: 1, 
        minHeight: '250px', 
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
    };

    const canvasStyle = {
        width: '100%',
        height: '100%',
        display: 'block'
    };
    
    const buttonStyle = {
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '5px 10px',
        borderRadius: '4px',
        backgroundColor: '#555',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.8rem',
        zIndex: 10
    };

    return (
        <div style={containerStyle}>
            <canvas ref={canvasRef} style={canvasStyle} />
            <button 
                style={buttonStyle} 
                onClick={() => setCurrentScale(prev => prev === 'linear' ? 'audiogram' : 'linear')}
            >
                Scale: {currentScale === 'linear' ? 'Linear' : 'Audiogram'}
            </button>
        </div>
    );
};

export default FrequencyChart;