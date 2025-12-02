/**
 * FrequencyGraph Component
 * 
 * Displays frequency spectrum with:
 * - FFT magnitude visualization
 * - Linear or Audiogram (logarithmic) scale
 * - Draggable slider overlays for visual EQ control
 * - Real-time updates
 */

import { useEffect, useRef, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Card } from './ui'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export function FrequencyGraph({
  fftData = null,
  sliders = [],
  scale = 'linear', // 'linear' or 'audiogram'
  onSliderDrag = null, // Future: for dragging sliders on graph
  showSliderOverlays = true,
  height = 300,
}) {
  const chartRef = useRef(null)
  const [chartData, setChartData] = useState(null)
  const [chartOptions, setChartOptions] = useState(null)

  // Process FFT data and create chart datasets
  useEffect(() => {
    if (!fftData || !fftData.frequencies || !fftData.magnitudes) {
      setChartData(null)
      return
    }

    const { frequencies, magnitudes } = fftData

    // Downsample data for better performance (show every Nth point)
    const maxPoints = 1000
    const step = Math.max(1, Math.floor(frequencies.length / maxPoints))
    
    const sampledFrequencies = []
    const sampledMagnitudes = []
    
    for (let i = 0; i < frequencies.length; i += step) {
      sampledFrequencies.push(frequencies[i])
      sampledMagnitudes.push(magnitudes[i])
    }

    // Convert magnitudes to dB if in audiogram mode
    const isAudiogramMode = scale === 'audiogram'
    
    // Find max magnitude for normalization
    const maxMag = Math.max(...sampledMagnitudes.filter(m => m > 0))
    
    const processedMagnitudes = isAudiogramMode 
      ? sampledMagnitudes.map(mag => {
          if (mag <= 0) return 120 // Silence = worst hearing (bottom)
          
          // Convert to dB and normalize to 0-120 range
          // Max magnitude -> 0 dB (top, best hearing)
          // Min magnitude -> 120 dB (bottom, worst hearing)
          const dbFromMax = 20 * Math.log10(mag / maxMag)
          const normalizedDB = -dbFromMax // Invert: louder = lower dB value
          
          // Clamp to 0-120 dB range
          return Math.max(0, Math.min(120, normalizedDB))
        })
      : sampledMagnitudes

    // Create chart data with x,y coordinates for proper scaling
    const data = {
      datasets: [
        {
          label: isAudiogramMode ? 'Hearing Level (dB)' : 'Magnitude',
          data: sampledFrequencies.map((freq, i) => ({
            x: freq,
            y: processedMagnitudes[i]
          })),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: !isAudiogramMode, // Only fill in linear mode
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    }

    // Add slider overlay datasets
    if (showSliderOverlays && sliders.length > 0) {
      sliders.forEach((slider, index) => {
        const sliderData = createSliderOverlay(
          slider,
          sampledFrequencies,
          sampledMagnitudes
        )
        
        // Color palette for different sliders
        const colors = [
          { border: 'rgba(255, 99, 132, 0.9)', bg: 'rgba(255, 99, 132, 0.15)' },   // Red
          { border: 'rgba(54, 162, 235, 0.9)', bg: 'rgba(54, 162, 235, 0.15)' },   // Blue
          { border: 'rgba(255, 206, 86, 0.9)', bg: 'rgba(255, 206, 86, 0.15)' },   // Yellow
          { border: 'rgba(75, 192, 192, 0.9)', bg: 'rgba(75, 192, 192, 0.15)' },   // Teal
          { border: 'rgba(153, 102, 255, 0.9)', bg: 'rgba(153, 102, 255, 0.15)' }, // Purple
          { border: 'rgba(255, 159, 64, 0.9)', bg: 'rgba(255, 159, 64, 0.15)' },   // Orange
        ]
        const colorSet = colors[index % colors.length]
        
        const gainLabel = slider.gain === 0 ? 'MUTE' : 
                         slider.gain < 1 ? `${((1 - slider.gain) * -100).toFixed(0)}%` :
                         `+${((slider.gain - 1) * 100).toFixed(0)}%`
        
        data.datasets.push({
          label: `Slider ${index + 1}: ${slider.center_freq}Hz (${gainLabel})`,
          data: sliderData,
          borderColor: colorSet.border,
          backgroundColor: colorSet.bg,
          borderWidth: 3,
          borderDash: [5, 5],
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
        })
      })
    }

    setChartData(data)
  }, [fftData, sliders, showSliderOverlays]) // createSliderOverlay is memoized with scale, no need to include it

  // Create chart options
  useEffect(() => {
    const isLogarithmic = scale === 'audiogram'

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgb(156, 163, 175)',
            font: { size: 11 },
            usePointStyle: true,
            padding: 10,
          },
        },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (context) => {
              const freq = parseFloat(context[0].label)
              return `${freq.toFixed(1)} Hz`
            },
            label: (context) => {
              const yValue = context.parsed.y
              if (scale === 'audiogram') {
                return `${context.dataset.label}: ${yValue.toFixed(1)} dB`
              }
              return `${context.dataset.label}: ${yValue.toFixed(4)}`
            },
          },
        },
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          title: {
            display: true,
            text: isLogarithmic ? 'Hearing Level (dB HL)' : 'Magnitude',
            color: 'rgb(156, 163, 175)',
            font: { size: 12 },
          },
          reverse: isLogarithmic, // Reverse Y-axis for audiogram: 0 at top, 120 at bottom
          min: isLogarithmic ? 0 : undefined,   // Start at 0 dB (top)
          max: isLogarithmic ? 120 : undefined, // End at 120 dB (bottom)
          ticks: {
            color: 'rgb(156, 163, 175)',
            stepSize: isLogarithmic ? 10 : undefined, // Grid lines every 10 dB
            callback: function(value) {
              if (isLogarithmic) {
                return value + ' dB'
              }
              return value.toFixed(2)
            }
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.1)',
          },
          beginAtZero: true,
        },
        x: {
          type: isLogarithmic ? 'logarithmic' : 'linear',
          display: true,
          title: {
            display: true,
            text: 'Frequency (Hz)',
            color: 'rgb(156, 163, 175)',
            font: { size: 12 },
          },
          min: isLogarithmic ? 20 : 0,
          max: isLogarithmic ? 20000 : 5000,
          ticks: {
            color: 'rgb(156, 163, 175)',
            callback: function(value) {
              if (isLogarithmic) {
                // Standard audiogram frequencies
                const freq = value
                const standardFreqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
                // Only show labels for standard frequencies
                if (standardFreqs.some(f => Math.abs(f - freq) < freq * 0.1)) {
                  return freq >= 1000 ? `${freq/1000}k` : freq.toString()
                }
                return ''
              }
              const freq = value
              if (freq >= 1000) {
                return `${(freq/1000).toFixed(1)}k`
              }
              return freq.toFixed(0)
            },
            autoSkip: false,
            maxTicksLimit: isLogarithmic ? 20 : 8,
          },
          afterBuildTicks: isLogarithmic ? function(axis) {
            // Force specific ticks for audiogram
            axis.ticks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].map(value => ({
              value: value
            }))
          } : undefined,
          grid: {
            color: 'rgba(156, 163, 175, 0.1)',
          },
        },
      },
      animation: {
        duration: 300,
      },
    }

    setChartOptions(options)
  }, [scale])

  // Create slider overlay data (bell curve representing the gain effect)
  // MUST match backend algorithm in equalizer_core.py create_gain_array_from_sliders()
  const createSliderOverlay = (slider, frequencies, baseMagnitudes) => {
    const { center_freq, width, gain } = slider
    
    // Determine effective range (matches backend logic)
    let effectiveRange
    if (gain < 0.1) {
      // MUTE: use 5x width for complete frequency elimination
      effectiveRange = (width / 2) * 5.0
    } else if (gain < 0.3 || gain > 1.7) {
      // Other extreme gains: use 3x width
      effectiveRange = (width / 2) * 3.0
    } else {
      // Moderate gain: use standard width
      effectiveRange = width / 2
    }
    
    return frequencies.map((freq, i) => {
      // Calculate distance from center frequency
      const distance = Math.abs(freq - center_freq)
      
      // If outside the effective range, skip this point
      if (distance > effectiveRange) return null
      
      // Normalized distance: 0 at center, 1 at edge of effective range
      const normalizedDist = distance / effectiveRange
      
      // Raised cosine bell curve (MATCHES BACKEND EXACTLY)
      // 1.0 at center, smoothly drops to 0 at edges
      const bellCurve = 0.5 * (1 + Math.cos(Math.PI * normalizedDist))
      
      // Calculate effective gain at this frequency
      // Full gain at center, unity gain (no effect) at edges
      const effectiveGain = 1.0 + (gain - 1.0) * bellCurve
      
      // Show the modified magnitude
      const baseMag = baseMagnitudes[i] || 0
      const modifiedMag = baseMag * effectiveGain
      
      return {
        x: freq,
        y: modifiedMag
      }
    }).filter(point => point !== null) // Remove null points outside width
  }

  if (!chartData || !chartOptions) {
    return (
      <div 
        className="flex items-center justify-center bg-muted/50 rounded-lg border border-dashed border-border"
        style={{ height: `${height}px` }}
      >
        <div className="text-center space-y-2">
          <p className="text-muted-foreground text-sm">No FFT Data</p>
          <p className="text-xs text-muted-foreground">
            Load a signal to see frequency spectrum
          </p>
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
