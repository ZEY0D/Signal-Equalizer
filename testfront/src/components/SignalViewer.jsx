/**
 * SignalViewer Component
 * 
 * Displays time-domain signal waveform:
 * - Input or output signal visualization
 * - Zoom and pan controls
 * - Time axis with proper scaling
 */

import { useEffect, useState, useRef } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
)

export function SignalViewer({
  signalData = null,
  title = 'Signal',
  color = 'rgb(34, 197, 94)',
  height = 200,
  sampleRate = 44100,
  zoomLevel = 1,
  resetTrigger = 0,
  syncId = null,
}) {
  const chartRef = useRef(null)
  const [chartData, setChartData] = useState(null)
  const [chartOptions, setChartOptions] = useState(null)

  // Process signal data
  useEffect(() => {
    if (!signalData) {
      setChartData(null)
      return
    }

    // Handle backend format: {signal, time_axis, sample_rate, length}
    // or alternative format: {time, amplitude}
    const timeData = signalData.time_axis || signalData.time
    const amplitudeData = signalData.signal || signalData.amplitude

    if (!timeData || !amplitudeData) {
      setChartData(null)
      return
    }

    const data = {
      labels: timeData,
      datasets: [
        {
          label: 'Amplitude',
          data: amplitudeData,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 0,
        },
      ],
    }

    setChartData(data)
  }, [signalData, color])

  // Create chart options
  useEffect(() => {
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: title,
          color: 'rgb(156, 163, 175)',
          font: { size: 13, weight: 'normal' },
          padding: { top: 5, bottom: 10 },
        },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (context) => {
              const time = parseFloat(context[0].label)
              return `Time: ${time.toFixed(4)}s`
            },
            label: (context) => {
              return `Amplitude: ${context.parsed.y.toFixed(4)}`
            },
          },
        },
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
              speed: 0.1,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x',
          },
          pan: {
            enabled: true,
            mode: 'x',
          },
          limits: {
            x: { min: 'original', max: 'original' },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          display: true,
          title: {
            display: true,
            text: 'Time (s)',
            color: 'rgb(156, 163, 175)',
            font: { size: 11 },
          },
          ticks: {
            color: 'rgb(156, 163, 175)',
            font: { size: 10 },
            callback: function(value) {
              return value.toFixed(2)
            },
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.1)',
          },
        },
        y: {
          type: 'linear',
          display: true,
          title: {
            display: true,
            text: 'Amplitude',
            color: 'rgb(156, 163, 175)',
            font: { size: 11 },
          },
          ticks: {
            color: 'rgb(156, 163, 175)',
            font: { size: 10 },
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.1)',
          },
        },
      },
      animation: {
        duration: 200,
      },
    }

    setChartOptions(options)
  }, [title])

  // Handle zoom synchronization
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    // Use Chart.js zoom plugin API
    if (zoomLevel !== 1) {
      chart.zoom({ x: zoomLevel, y: 1 })
    }
  }, [zoomLevel])

  // Handle reset trigger
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || resetTrigger === 0) return

    // Reset zoom using zoom plugin API
    chart.resetZoom()
  }, [resetTrigger])

  if (!chartData || !chartOptions) {
    return (
      <div 
        className="flex items-center justify-center bg-muted/50 rounded-lg border border-dashed border-border"
        style={{ height: `${height}px` }}
      >
        <div className="text-center space-y-1">
          <p className="text-muted-foreground text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">No data</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: `${height}px` }}>
      <Line ref={chartRef} data={chartData} options={chartOptions} />
    </div>
  )
}
