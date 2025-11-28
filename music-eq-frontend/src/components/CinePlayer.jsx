// // import React, { useRef, useEffect, useState } from "react";
// // import Chart from "chart.js/auto";

// // export default function CinePlayer({ data, audioSrc }) {
// //   const audioRef = useRef(null);
// //   const chartRef = useRef(null);
// //   const canvasRef = useRef(null);
  
// //   const [isPlaying, setIsPlaying] = useState(false);
// //   const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 2 = 200%

// //   // Audio Controls
// //   const togglePlay = () => {
// //     if (!audioRef.current) return;
// //     if (isPlaying) audioRef.current.pause();
// //     else audioRef.current.play();
// //     setIsPlaying(!isPlaying);
// //   };

// //   // Chart Logic
// //   useEffect(() => {
// //     if (!canvasRef.current || !data.length) return;

// //     // Apply Zoom: Slice the data array
// //     const visiblePoints = Math.floor(data.length / zoomLevel);
// //     const chartData = data.slice(0, visiblePoints);

// //     if (!chartRef.current) {
// //       chartRef.current = new Chart(canvasRef.current, {
// //         type: "line",
// //         data: {
// //           labels: chartData.map((_, i) => i),
// //           datasets: [{
// //             label: "Amplitude",
// //             data: chartData,
// //             borderColor: "#00d4ff",
// //             borderWidth: 1,
// //             pointRadius: 0,
// //             tension: 0.1
// //           }]
// //         },
// //         options: {
// //           responsive: true,
// //           maintainAspectRatio: false,
// //           animation: false,
// //           scales: {
// //             x: { display: false }, // Hide X axis for cleaner look
// //             y: { min: -32000, max: 32000 } // 16-bit audio range
// //           }
// //         }
// //       });
// //     } else {
// //       chartRef.current.data.labels = chartData.map((_, i) => i);
// //       chartRef.current.data.datasets[0].data = chartData;
// //       chartRef.current.update("none");
// //     }
// //   }, [data, zoomLevel]);

// //   return (
// //     <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
// //       <div style={{ flexGrow: 1, position: "relative" }}>
// //         <canvas ref={canvasRef} />
// //       </div>
      
// //       {/* Controls Toolbar */}
// //       <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
// //         <button onClick={togglePlay}>{isPlaying ? "Stop" : "Play"}</button>
// //         <button onClick={() => setZoomLevel(prev => Math.min(prev + 1, 10))}>Zoom In (+)</button>
// //         <button onClick={() => setZoomLevel(prev => Math.max(prev - 1, 1))}>Zoom Out (-)</button>
// //       </div>

// //       {/* Hidden Audio Element */}
// //       {audioSrc && <audio ref={audioRef} src={audioSrc} onEnded={() => setIsPlaying(false)} />}
// //     </div>
// //   );
// // }
// // src/components/CinePlayer.jsx (Time Domain + Play + Zoom)
// import React, { useRef, useEffect, useState } from "react";
// import Chart from "chart.js/auto";

// export default function CinePlayer({ data, audioSrc }) {
//   const audioRef = useRef(null);
//   const chartRef = useRef(null);
//   const canvasRef = useRef(null);
  
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 2 = 200%

//   // Audio Controls
//   const togglePlay = () => {
//     if (!audioRef.current) return;
//     if (isPlaying) {
//       audioRef.current.pause();
//     } else {
//       // Must load the new source first if it's been updated
//       audioRef.current.load(); 
//       audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
//     }
//     setIsPlaying(!isPlaying);
//   };

//   // Chart Logic (Unchanged from previous version, handles visualization)
//   useEffect(() => {
//     if (!canvasRef.current) return;

//     const chartData = data.slice(0, Math.floor(data.length / zoomLevel));

//     if (!chartRef.current) {
//       chartRef.current = new Chart(canvasRef.current, {
//         type: "line",
//         data: {
//           labels: chartData.map((_, i) => i),
//           datasets: [{
//             label: "Amplitude",
//             data: chartData,
//             borderColor: "#00d4ff",
//             borderWidth: 1,
//             pointRadius: 0,
//             tension: 0.1
//           }]
//         },
//         options: {
//           responsive: true,
//           maintainAspectRatio: false,
//           animation: false,
//           scales: {
//             x: { display: false },
//             y: { min: -32000, max: 32000 }
//           }
//         }
//       });
//     } else {
//       chartRef.current.data.labels = chartData.map((_, i) => i);
//       chartRef.current.data.datasets[0].data = chartData;
//       chartRef.current.update("none");
//     }
//   }, [data, zoomLevel]);

//   return (
//     <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
//       <div style={{ flexGrow: 1, position: "relative" }}>
//         <canvas ref={canvasRef} />
//       </div>
      
//       {/* Controls Toolbar */}
//       <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
//         <button onClick={togglePlay} disabled={!audioSrc}>{isPlaying ? "Stop" : "Play"}</button>
//         <button onClick={() => setZoomLevel(prev => Math.min(prev + 1, 10))} disabled={!audioSrc}>Zoom In (+)</button>
//         <button onClick={() => setZoomLevel(prev => Math.max(prev - 1, 1))} disabled={!audioSrc}>Zoom Out (-)</button>
//       </div>

//       {/* Hidden Audio Element - Crucial: key forces re-render when URL changes */}
//       {audioSrc && (
//         <audio 
//             ref={audioRef} 
//             src={audioSrc} 
//             onEnded={() => setIsPlaying(false)}
//             key={audioSrc} // Key is CRITICAL to force HTML to load the new WAV data
//         />
//       )}
//     </div>
//   );
// }
import React, { useRef, useEffect, useCallback, useState } from 'react';

const CinePlayer = ({ data, audioSrc, type, viewWindow, onViewChange }) => {
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // --- Drawing Logic ---
    const drawWaveform = useCallback((canvas, data, xMin, xMax) => {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        
        if (!data || data.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`No ${type} Signal Loaded`, width / 2, height / 2);
            return;
        }
        
        const startIdx = Math.floor(data.length * xMin);
        const endIdx = Math.floor(data.length * xMax);
        const visibleLength = endIdx - startIdx;
        
        ctx.strokeStyle = type === 'input' ? '#4A90E2' : '#F5A623'; // Blue for Input, Orange for Output
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        // Use a fixed number of samples for drawing for consistent performance
        const maxPoints = 1000;
        const step = Math.ceil(visibleLength / maxPoints);

        for (let i = 0; i < visibleLength; i += step) {
            const dataIndex = startIdx + i;
            if (dataIndex >= data.length) break;
            
            // x: (0 to 1) normalized visible range
            const x = (i / visibleLength) * width;
            // y: Normalize value from signal range (-1 to 1) to canvas height
            const y = (0.5 - data[dataIndex] * 0.5) * height; 
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

    }, [type]);

    // --- Effects and Initial Setup ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // Make the canvas responsive to its parent size
        const rect = canvas.parentNode.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height - 50; // Leave space for audio controls
        drawWaveform(canvas, data, viewWindow.xMin, viewWindow.xMax);
    }, [data, viewWindow, drawWaveform]);
    
    useEffect(() => {
        if (audioRef.current && audioSrc) {
            // Reload audio when source changes (due to signal processing)
            audioRef.current.load();
        }
    }, [audioSrc]);

    // --- Playback Handlers ---
    const handlePlayPause = () => {
        if (!audioRef.current || !audioSrc) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            // Start playing from the currently zoomed view start time
            const duration = audioRef.current.duration;
            audioRef.current.currentTime = duration * viewWindow.xMin || 0;
            audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
        }
        setIsPlaying(!isPlaying);
    };

    // --- Zoom/Pan Handlers (updates parent state via onViewChange) ---
    const handleZoom = (direction) => {
        if (!data || data.length === 0) return;
        const center = (viewWindow.xMin + viewWindow.xMax) / 2;
        let newSpan = viewWindow.xMax - viewWindow.xMin;
        
        if (direction === 'in') {
            newSpan = Math.max(0.01, newSpan * 0.5); // Zoom in, limit zoom level
        } else { // 'out'
            newSpan = Math.min(1.0, newSpan * 2.0);  // Zoom out, max 1x (full view)
        }

        const newXMin = Math.max(0, center - newSpan / 2);
        const newXMax = Math.min(1, center + newSpan / 2);
        
        // Adjust bounds if hit edge
        if (newXMax - newXMin < newSpan) {
            if (newXMin === 0) { newSpan = newXMax; } 
            if (newXMax === 1) { newSpan = 1 - newXMin; } 
        }

        onViewChange({ xMin: newXMin, xMax: newXMax });
    };
    
    // Simple drag panning logic
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startViewWindow = useRef({ xMin: 0, xMax: 1 });

    const handleMouseDown = (e) => {
        if (!data || data.length === 0) return;
        isDragging.current = true;
        startX.current = e.clientX;
        startViewWindow.current = viewWindow;
        e.currentTarget.style.cursor = 'grabbing';
    };

    const handleMouseUp = (e) => {
        isDragging.current = false;
        e.currentTarget.style.cursor = 'grab';
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current || !data || data.length === 0) return;
        
        const deltaX = e.clientX - startX.current;
        const canvasWidth = canvasRef.current.width;
        
        // Calculate the proportion of the visible signal being dragged
        const viewSpan = startViewWindow.current.xMax - startViewWindow.current.xMin;
        const dragRatio = deltaX / canvasWidth; 
        const signalShift = dragRatio * viewSpan;
        
        let newXMin = startViewWindow.current.xMin - signalShift;
        let newXMax = startViewWindow.current.xMax - signalShift;
        
        // Clamp the view to the 0-1 range
        if (newXMin < 0) {
            newXMax -= newXMin;
            newXMin = 0;
        } else if (newXMax > 1) {
            newXMin -= (newXMax - 1);
            newXMax = 1;
        }

        onViewChange({ xMin: newXMin, xMax: newXMax });
    };
    
    const containerStyle = {
        flexGrow: 1, 
        minHeight: '250px', 
        display: 'flex', 
        flexDirection: 'column', 
        position: 'relative',
        cursor: 'grab'
    };
    
    const canvasStyle = {
        width: '100%',
        height: '100%',
        display: 'block',
        minHeight: '200px',
    };

    const buttonContainerStyle = {
        display: 'flex',
        justifyContent: 'center',
        gap: '10px',
        paddingTop: '10px'
    };

    const buttonStyle = {
        padding: '8px 15px',
        borderRadius: '4px',
        backgroundColor: type === 'input' ? '#4A90E2' : '#F5A623',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.9rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transition: 'background-color 0.15s'
    };


    return (
        <div 
            style={containerStyle}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp} // Stop dragging if mouse leaves the container
            onMouseMove={handleMouseMove}
        >
            <canvas ref={canvasRef} style={canvasStyle} />
            
            <audio 
                ref={audioRef} 
                src={audioSrc} 
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                style={{ width: '100%', marginTop: '10px', display: audioSrc ? 'block' : 'none' }}
            />

            <div style={buttonContainerStyle}>
                <button style={buttonStyle} onClick={handlePlayPause} disabled={!audioSrc}>
                    {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button style={buttonStyle} onClick={() => handleZoom('in')} disabled={!audioSrc || viewWindow.xMax - viewWindow.xMin <= 0.01}>
                    Zoom In (+)
                </button>
                <button style={buttonStyle} onClick={() => handleZoom('out')} disabled={!audioSrc || viewWindow.xMax - viewWindow.xMin >= 1.0}>
                    Zoom Out (-)
                </button>
                <button style={buttonStyle} onClick={() => onViewChange({ xMin: 0, xMax: 1 })} disabled={!audioSrc || (viewWindow.xMin === 0 && viewWindow.xMax === 1)}>
                    Reset View
                </button>
            </div>
        </div>
    );
};

export default CinePlayer;