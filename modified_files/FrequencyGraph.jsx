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
import { Card } from '@/components'

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

    // Create chart data with x,y coordinates for proper scaling
    const data = {
      datasets: [
        {
          label: 'Magnitude',
          data: sampledFrequencies.map((freq, i) => ({
            x: freq,
            y: sampledMagnitudes[i]
          })),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
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
              return `${context.dataset.label}: ${context.parsed.y.toFixed(4)}`
            },
          },
        },
      },
      scales: {
        x: {
          type: isLogarithmic ? 'logarithmic' : 'linear',
          display: true,
          title: {
            display: true,
            text: 'Frequency (Hz)',
            color: 'rgb(156, 163, 175)',
            font: { size: 12 },
          },
          min: 0,
          max: 5000, // Show up to 5 kHz for clarity
          ticks: {
            color: 'rgb(156, 163, 175)',
            callback: function(value, index, ticks) {
              if (isLogarithmic) {
                // Show specific frequency points for logarithmic scale
                const freq = parseFloat(this.getLabelForValue(value))
                if ([20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].includes(Math.round(freq))) {
                  return freq >= 1000 ? `${freq/1000}k` : freq.toString()
                }
                return ''
              }
              // Linear scale - show cleaner labels
              const freq = value
              if (freq >= 1000) {
                return `${(freq/1000).toFixed(1)}k`
              }
              return freq.toFixed(0)
            },
            autoSkip: true,
            maxTicksLimit: isLogarithmic ? 15 : 8,
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
            text: 'Magnitude',
            color: 'rgb(156, 163, 175)',
            font: { size: 12 },
          },
          ticks: {
            color: 'rgb(156, 163, 175)',
            callback: function(value) {
              return value.toFixed(2)
            }
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.1)',
          },
          beginAtZero: scale === 'linear',
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
    
    return frequencies.map((freq, i) => {
      // Calculate distance from center frequency
      const distance = Math.abs(freq - center_freq)
      
      // If outside the width range, skip this point
      if (distance > width / 2) return null
      
      // Normalized distance: 0 at center, 1 at edge
      const normalizedDist = distance / (width / 2)
      
      // Bell curve using raised cosine (smooth transition)
      // 1.0 at center, smoothly drops to 0 at edges
      // MATCHES backend: 0.5 * (1 + np.cos(np.pi * normalized_dist))
      const bellCurve = 0.5 * (1 + Math.cos(Math.PI * normalizedDist))
      
      // Calculate effective gain at this frequency
      // Full gain at center, unity gain (no effect) at edges
      // MATCHES backend: 1.0 + (gain - 1.0) * bell_curve
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
