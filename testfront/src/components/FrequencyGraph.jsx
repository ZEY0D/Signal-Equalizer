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

    // Convert linear magnitude to dB scale: 20 * log10(magnitude)
    // Add small epsilon to avoid log(0)
    const epsilon = 1e-10
    const magnitudesDB = magnitudes.map(mag => 20 * Math.log10(mag + epsilon))

    // Downsample data for better performance (show every Nth point)
    const maxPoints = 1000
    const step = Math.max(1, Math.floor(frequencies.length / maxPoints))
    
    const sampledFrequencies = []
    const sampledMagnitudes = []
    
    for (let i = 0; i < frequencies.length; i += step) {
      sampledFrequencies.push(frequencies[i])
      sampledMagnitudes.push(magnitudesDB[i])
    }

    // Create chart data with x,y coordinates for proper scaling
    const data = {
      datasets: [
        {
          label: 'Magnitude (dB)',
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
        
        data.datasets.push({
          label: `Slider ${index + 1} (${slider.center_freq}Hz)`,
          data: sliderData,
          borderColor: `hsla(${(index * 60) % 360}, 70%, 50%, 0.8)`,
          backgroundColor: `hsla(${(index * 60) % 360}, 70%, 50%, 0.2)`,
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          spanGaps: true, // Connect points even if there are nulls
        })
      })
    }

    setChartData(data)
  }, [fftData, sliders, showSliderOverlays])

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
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} dB`
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
                // Show specific frequency points for audiogram
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
            text: 'Magnitude (dB)',
            color: 'rgb(156, 163, 175)',
            font: { size: 12 },
          },
          ticks: {
            color: 'rgb(156, 163, 175)',
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.1)',
          },
          // Allow auto-scaling to fit the data
          beginAtZero: false,
        },
      },
      animation: {
        duration: 300,
      },
    }

    setChartOptions(options)
  }, [scale])

  // Create slider overlay data (bell curve representing the gain)
  const createSliderOverlay = (slider, frequencies, baseMagnitudes) => {
    const { center_freq, width, gain } = slider
    
    return frequencies.map((freq, i) => {
      // Calculate distance from center frequency
      const distance = Math.abs(freq - center_freq)
      
      // If outside the width, return null (no overlay)
      if (distance > width / 2) return null
      
      // Create a bell curve for the gain
      const normalizedDistance = (distance / (width / 2))
      const bellCurve = Math.cos(normalizedDistance * Math.PI / 2) ** 2
      
      // Calculate gain in dB (gain of 1.0 = 0dB, 2.0 = +6dB, 0.5 = -6dB)
      const gainDB = 20 * Math.log10(gain)
      
      // Apply to base magnitude
      const baseMag = baseMagnitudes[i] || 0
      return {
        x: freq,
        y: baseMag + (gainDB * bellCurve)
      }
    }).filter(point => point !== null) // Remove null points
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
