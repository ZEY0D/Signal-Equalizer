import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Spectrogram Component
 * Displays a time-frequency representation of the signal
 * 
 * @param {Object} spectrogramData - Data from backend: {times, frequencies, magnitude, sample_rate}
 * @param {string} title - Chart title
 * @param {number} height - Chart height in pixels
 * @param {number} maxFreq - Maximum frequency to display (Hz)
 */
const Spectrogram = ({ spectrogramData, title = "Spectrogram", height = 300, maxFreq = 5000 }) => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!spectrogramData || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const { times, frequencies, magnitude } = spectrogramData;

    if (!times || !frequencies || !magnitude || times.length === 0) {
      return;
    }

    // Filter frequencies up to maxFreq
    const freqIndices = frequencies.map((f, i) => f <= maxFreq ? i : -1).filter(i => i >= 0);
    const filteredFreqs = freqIndices.map(i => frequencies[i]);

    // Convert magnitude to dB scale and normalize
    const magnitudeDB = magnitude.map(timeSlice => {
      return freqIndices.map(i => {
        const mag = timeSlice[i] || 0;
        return mag > 0 ? 20 * Math.log10(mag) : -100;
      });
    });

    // Find global min/max for color scaling
    let minDB = Infinity;
    let maxDB = -Infinity;
    magnitudeDB.forEach(timeSlice => {
      timeSlice.forEach(val => {
        if (val > -100) {
          minDB = Math.min(minDB, val);
          maxDB = Math.max(maxDB, val);
        }
      });
    });

    // Create color-mapped image data
    const canvas = document.createElement('canvas');
    canvas.width = times.length;
    canvas.height = filteredFreqs.length;
    const imageCtx = canvas.getContext('2d');
    const imageData = imageCtx.createImageData(canvas.width, canvas.height);

    // Fill image data with colors (hot colormap)
    for (let t = 0; t < times.length; t++) {
      for (let f = 0; f < filteredFreqs.length; f++) {
        const value = magnitudeDB[t][f];
        const normalized = (value - minDB) / (maxDB - minDB);
        
        // Hot colormap: black -> red -> yellow -> white
        let r, g, b;
        if (normalized < 0.33) {
          const val = normalized / 0.33;
          r = Math.floor(255 * val);
          g = 0;
          b = 0;
        } else if (normalized < 0.66) {
          const val = (normalized - 0.33) / 0.33;
          r = 255;
          g = Math.floor(255 * val);
          b = 0;
        } else {
          const val = (normalized - 0.66) / 0.34;
          r = 255;
          g = 255;
          b = Math.floor(255 * val);
        }

        const pixelIndex = (f * canvas.width + t) * 4;
        imageData.data[pixelIndex] = r;
        imageData.data[pixelIndex + 1] = g;
        imageData.data[pixelIndex + 2] = b;
        imageData.data[pixelIndex + 3] = 255; // Alpha
      }
    }

    imageCtx.putImageData(imageData, 0, 0);

    // Create Chart.js chart with the spectrogram as background
    chartRef.current = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          data: [],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: title,
            color: 'rgb(156, 163, 175)',
            font: { size: 14 }
          },
          tooltip: {
            enabled: false
          }
        },
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Time (s)',
              color: 'rgb(156, 163, 175)'
            },
            min: times[0],
            max: times[times.length - 1],
            ticks: { color: 'rgb(156, 163, 175)' },
            grid: { color: 'rgba(156, 163, 175, 0.2)' }
          },
          y: {
            type: 'linear',
            title: {
              display: true,
              text: 'Frequency (Hz)',
              color: 'rgb(156, 163, 175)'
            },
            min: 0,
            max: maxFreq,
            ticks: { color: 'rgb(156, 163, 175)' },
            grid: { color: 'rgba(156, 163, 175, 0.2)' }
          }
        }
      },
      plugins: [{
        id: 'spectrogramBackground',
        beforeDraw: (chart) => {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          
          ctx.save();
          ctx.drawImage(
            canvas,
            chartArea.left,
            chartArea.top,
            chartArea.right - chartArea.left,
            chartArea.bottom - chartArea.top
          );
          ctx.restore();
        }
      }]
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [spectrogramData, title, height, maxFreq]);

  if (!spectrogramData) {
    return (
      <div 
        style={{ height: `${height}px` }} 
        className="flex items-center justify-center bg-muted/20 rounded border border-border"
      >
        <p className="text-muted-foreground text-sm">No spectrogram data available</p>
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px`, position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default Spectrogram;
