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
  onZoomChange = null,
  playbackProgress = 0,
  isPlaying = false,
}) {
  const chartRef = useRef(null)
  const [chartData, setChartData] = useState(null)
  const [chartOptions, setChartOptions] = useState(null)
  const lastZoomLevelRef = useRef(zoomLevel)
  const playbackLineRef = useRef(null)

  // Process signal data (only when signalData changes, not on every playback update)
  useEffect(() => {
    if (!signalData) {
      // Only log once when transitioning to no data
      if (chartData !== null) {
        console.log(`📉 ${title}: No signal data`);
      }
      setChartData(null)
      return
    }

    // Handle backend format: {signal, time_axis, sample_rate, length}
    // or alternative format: {time, amplitude}
    const timeData = signalData.time_axis || signalData.time
    const amplitudeData = signalData.signal || signalData.amplitude

    if (!timeData || !amplitudeData) {
      if (chartData !== null) {
        console.log(`📉 ${title}: Missing time or amplitude data`);
      }
      setChartData(null)
      return
    }

    // Only log when NOT during playback updates to avoid console spam
    if (!isPlaying || playbackProgress === 0) {
      console.log(`📈 ${title}: Updating chart with signal data:`, {
        points: amplitudeData.length,
        maxAmplitude: Math.max(...amplitudeData.map(Math.abs)),
        timeRange: [timeData[0], timeData[timeData.length - 1]]
      });
    }

    // Convert to x,y format for proper linear x-axis handling
    const xyData = timeData.map((time, i) => ({ x: time, y: amplitudeData[i] }))

    const datasets = [
      {
        label: 'Amplitude',
        data: xyData,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 0,
        showLine: true,
      },
    ]

    // Add playback progress line if playing
    if (isPlaying && playbackProgress > 0) {
      const minAmplitude = Math.min(...amplitudeData)
      const maxAmplitude = Math.max(...amplitudeData)
      
      datasets.push({
        label: 'Playback Position',
        data: [
          { x: playbackProgress, y: minAmplitude },
          { x: playbackProgress, y: maxAmplitude }
        ],
        borderColor: 'rgba(255, 215, 0, 0.9)',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderWidth: 3,
        pointRadius: 0,
        fill: false,
        showLine: true,
        tension: 0,
      })
    }

    const data = {
      datasets: datasets,
    }

    setChartData(data)
  }, [signalData, color, isPlaying, playbackProgress])

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
              speed: 0.05,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x',
            onZoomComplete: ({ chart }) => {
              // Notify parent of zoom change for synchronization
              if (onZoomChange && chart.scales.x && chartData) {
                const xScale = chart.scales.x
                const currentRange = xScale.max - xScale.min
                
                // Get original data range
                const dataMin = Math.min(...chartData.datasets[0].data.map(d => d.x))
                const dataMax = Math.max(...chartData.datasets[0].data.map(d => d.x))
                const originalRange = dataMax - dataMin
                
                const newZoomLevel = Math.max(0.1, Math.min(10, originalRange / currentRange))
                
                // Only call if actually changed to avoid loops
                if (Math.abs(lastZoomLevelRef.current - newZoomLevel) > 0.01) {
                  lastZoomLevelRef.current = newZoomLevel
                  onZoomChange(newZoomLevel)
                }
              }
            },
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
    if (!chart || !chart.scales.x || !chartData) return

    // Only update if zoomLevel actually changed (avoid infinite loops)
    if (Math.abs(lastZoomLevelRef.current - zoomLevel) < 0.01) return
    
    lastZoomLevelRef.current = zoomLevel

    if (zoomLevel === 1) {
      // Reset to original view
      chart.resetZoom()
    } else {
      // Apply zoom level by modifying scale directly
      const xScale = chart.scales.x
      const currentMin = xScale.min
      const currentMax = xScale.max
      const center = (currentMin + currentMax) / 2
      
      // Get original data range
      const dataMin = xScale.options.min || Math.min(...chartData.datasets[0].data.map(d => d.x))
      const dataMax = xScale.options.max || Math.max(...chartData.datasets[0].data.map(d => d.x))
      const originalRange = dataMax - dataMin
      
      const newRange = originalRange / zoomLevel
      
      // Keep within data bounds
      let newMin = center - newRange / 2
      let newMax = center + newRange / 2
      
      if (newMin < dataMin) {
        newMin = dataMin
        newMax = dataMin + newRange
      }
      if (newMax > dataMax) {
        newMax = dataMax
        newMin = dataMax - newRange
      }
      
      xScale.options.min = newMin
      xScale.options.max = newMax
      chart.update('none')
    }
  }, [zoomLevel, chartData])

  // Handle reset trigger
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || resetTrigger === 0) return

    // Reset zoom using zoom plugin API
    chart.resetZoom()
    lastZoomLevelRef.current = 1
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
