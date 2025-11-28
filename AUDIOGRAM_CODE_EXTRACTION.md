# Audiogram Implementation - Complete Code Package

## 📋 Prompt for New Copilot Project

```
I need to create a React component that visualizes audio frequency spectrum data with two modes:

1. **Linear Mode**: Standard FFT visualization with linear frequency and magnitude scales
2. **Audiogram Mode**: Medical hearing test format with:
   - Logarithmic X-axis (20Hz to 20kHz) - human hearing range
   - Inverted Y-axis in decibels (0 dB at TOP = good hearing, 120 dB at BOTTOM = hearing loss)
   - Grid lines every 10 dB with labels
   - Frequency labels at standard audiogram points (20, 50, 100, 200, 500, 1k, 2k, 5k, 10k, 20k Hz)

The component should:
- Accept an array of magnitude data (FFT output)
- Draw on HTML5 Canvas for performance
- Have a toggle button to switch between Linear and Audiogram modes
- Include detailed comments explaining the math (log10, dB conversion, inverted scale)

Data format: `data` is an array of magnitude values from FFT (0 to Nyquist frequency ~22050 Hz)

Please implement this with proper logarithmic scaling, dB conversion (20*log10), and the inverted Y-axis as used in medical audiograms.
```

---

## 🎯 Complete React Component Code

```jsx
import React, { useRef, useEffect, useCallback, useState } from 'react';

/**
 * FrequencyChart Component
 * Visualizes frequency spectrum data in two modes:
 * 1. Linear: Standard FFT plot
 * 2. Audiogram: Medical hearing test format with logarithmic frequency and inverted dB scale
 * 
 * @param {Array} data - Array of magnitude values from FFT (0 Hz to Nyquist ~22050 Hz)
 * @param {String} type - "input" or "output" for color differentiation
 */
const FrequencyChart = ({ data, type }) => {
    const canvasRef = useRef(null);
    const [currentScale, setCurrentScale] = useState('linear'); 
    
    const hasData = data && data.length > 0;

    const drawChart = useCallback((canvas, data, scale) => {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        
        if (!hasData) {
            ctx.fillStyle = '#666';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`No ${type} FFT Data Loaded`, width / 2, height / 2);
            return;
        }

        // ===== AUDIOGRAM SCALE SETUP =====
        // Audiogram uses logarithmic frequency scale (20Hz to 20kHz)
        // Why? Human hearing is logarithmic - we perceive octaves (doubling of frequency) equally
        // Example: 100Hz to 200Hz sounds the same "distance" as 1000Hz to 2000Hz
        const minFreq = 20;      // Lowest frequency humans can hear
        const maxFreq = 20000;   // Highest frequency humans can hear (20kHz)
        const logMinFreq = Math.log10(minFreq);  // log10(20) = 1.301
        const logMaxFreq = Math.log10(maxFreq);  // log10(20000) = 4.301
        
        // ===== AUDIOGRAM Y-AXIS (dB SCALE, INVERTED) =====
        // In audiograms, Y-axis shows "Hearing Level" in decibels (dB HL)
        // INVERTED: 0 dB at TOP = normal/good hearing
        //          120 dB at BOTTOM = severe hearing loss
        // This matches medical audiogram convention used by audiologists
        const minDB = -10;   // Top of chart (better than normal hearing)
        const maxDB = 120;   // Bottom of chart (profound hearing loss)
        const dbRange = maxDB - minDB;  // Total range = 130 dB
        
        // Find the maximum magnitude in our data for normalization
        let maxDataValue = 0;
        if (hasData) {
            maxDataValue = data.reduce((max, val) => Math.max(max, val), 0);
        }
        
        const dataLength = data.length;
        
        // ===== MARGINS FOR AUDIOGRAM GRID =====
        // We need margins to fit the axis labels and grid
        const marginLeft = 40;    // Space for Y-axis labels (dB values)
        const marginRight = 10;
        const marginTop = 30;     // Space for title
        const marginBottom = 30;  // Space for X-axis labels (frequencies)
        const plotWidth = width - marginLeft - marginRight;
        const plotHeight = height - marginTop - marginBottom;
        
        // ===== DRAW AUDIOGRAM GRID (only in audiogram mode) =====
        if (scale === 'audiogram') {
            ctx.strokeStyle = '#333';
            ctx.fillStyle = '#888';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.lineWidth = 0.5;
            
            // Draw horizontal grid lines every 10 dB
            // These help read the hearing level at any point on the graph
            const dbSteps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
            dbSteps.forEach(db => {
                // Calculate Y position for this dB level
                // (db - minDB) / dbRange gives us a value from 0 to 1
                // Multiply by plotHeight to get pixel position
                const yPos = marginTop + ((db - minDB) / dbRange) * plotHeight;
                
                // Draw the dB label on the left
                ctx.fillText(`${db} dB`, marginLeft - 5, yPos + 3);
                
                // Draw horizontal grid line
                ctx.beginPath();
                ctx.moveTo(marginLeft, yPos);
                ctx.lineTo(marginLeft + plotWidth, yPos);
                ctx.stroke();
            });
            
            // Draw Y-axis label (rotated 90 degrees)
            ctx.save();
            ctx.translate(15, height / 2);
            ctx.rotate(-Math.PI / 2);  // Rotate counter-clockwise
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ccc';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('Hearing Level (dB HL)', 0, 0);
            ctx.restore();
        }

        // Set line color based on input/output
        ctx.strokeStyle = type === 'input' ? '#4A90E2' : '#F5A623';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        let started = false;
        
        // ===== MAIN LOOP: DRAW THE SPECTRUM LINE =====
        for (let i = 0; i < dataLength; i++) {
            let x, y;
            
            if (scale === 'audiogram') {
                // ===== AUDIOGRAM MODE =====
                
                // STEP 1: Calculate the frequency for this data point
                // Assumption: data[i] represents frequency bin i
                // FFT divides the signal from 0 Hz to Nyquist frequency (half of sample rate)
                // For typical audio at 44100 Hz sample rate, Nyquist = 22050 Hz
                const freq = (i / dataLength) * 22050;
                
                // Skip frequencies below 20 Hz (below human hearing range)
                if (freq < minFreq) {
                    continue;
                }
                
                // STEP 2: X-axis position (LOGARITHMIC)
                // Clamp frequency to our range (20 Hz to 20 kHz)
                const clampedFreq = Math.min(Math.max(freq, minFreq), maxFreq);
                
                // Convert to logarithmic scale
                const logFreq = Math.log10(clampedFreq);
                
                // Normalize to 0-1 range
                // Example: 100 Hz → log10(100)=2 → (2-1.301)/(4.301-1.301) = 0.233
                //         1000 Hz → log10(1000)=3 → (3-1.301)/(4.301-1.301) = 0.566
                // Notice: 1000Hz (10x higher) is NOT 10x further, but roughly 2.4x
                const normalizedLogPos = (logFreq - logMinFreq) / (logMaxFreq - logMinFreq);
                x = marginLeft + normalizedLogPos * plotWidth;
                
                // STEP 3: Y-axis position (dB, INVERTED)
                // Convert magnitude to decibels: dB = 20 * log10(magnitude)
                // Why 20? Because power is proportional to magnitude squared, and 10*log10(mag²) = 20*log10(mag)
                const magnitudeDB = data[i] > 0 ? 20 * Math.log10(data[i]) : -100;
                
                // Normalize the dB value relative to our maximum
                const maxMagnitudeDB = maxDataValue > 0 ? 20 * Math.log10(maxDataValue) : 0;
                
                // Invert: subtract from max so louder sounds appear at top (less hearing loss)
                const normalizedDB = maxMagnitudeDB - magnitudeDB;
                
                // Clamp to our dB range (-10 to 120)
                const clampedDB = Math.min(Math.max(normalizedDB, minDB), maxDB);
                
                // Convert to Y position (0 dB at top, 120 dB at bottom)
                const dbPos = (clampedDB - minDB) / dbRange;  // 0 to 1
                y = marginTop + dbPos * plotHeight;  // Top to bottom
                
            } else {
                // ===== LINEAR MODE (Standard FFT visualization) =====
                
                // STEP 1: X-axis position (LINEAR)
                // Simply divide the width equally among all frequency bins
                // Bin 0 → x=0, Bin dataLength → x=width
                x = (i / dataLength) * width;
                
                // STEP 2: Y-axis position (LINEAR MAGNITUDE)
                // Normalize magnitude to 0-1 range
                let normalizedMag = data[i] / (maxDataValue || 1);
                
                // Convert to pixel position (bottom to top)
                // Higher magnitude → higher on screen
                // We use 80% of height to leave some margin at top
                y = height - (normalizedMag * height * 0.8); 
            }
            
            // Draw the line
            if (!started) {
                if (scale === 'audiogram') {
                    ctx.moveTo(x, y);  // Start at first valid point
                } else {
                    ctx.moveTo(x, height);  // Start from bottom for filled area
                }
                started = true;
            }
            ctx.lineTo(x, y);
        }
        
        if (scale === 'audiogram') {
            // Audiogram: just draw the line (no fill)
            ctx.stroke();
        } else {
            // Linear: fill the area under the curve
            ctx.lineTo(width, height);  // Line to bottom-right
            ctx.closePath();
            ctx.fillStyle = type === 'input' ? 'rgba(74, 144, 226, 0.4)' : 'rgba(245, 166, 35, 0.4)'; 
            ctx.fill();
            ctx.stroke();
        }

        // ===== DRAW FREQUENCY LABELS (X-AXIS) for audiogram =====
        if (scale === 'audiogram') {
            ctx.fillStyle = '#888';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            
            // Standard audiogram frequencies (used in hearing tests)
            // These are spread logarithmically across the hearing range
            const freqLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
            freqLabels.forEach(freq => {
                // Calculate X position using same logarithmic formula
                const logFreq = Math.log10(freq);
                const normalizedLogPos = (logFreq - logMinFreq) / (logMaxFreq - logMinFreq);
                const x = marginLeft + normalizedLogPos * plotWidth;
                
                // Format label (use 'k' for thousands)
                ctx.fillText(freq >= 1000 ? `${freq/1000}k` : freq, x, height - 10);
            });
            
            // X-axis label
            ctx.fillStyle = '#ccc';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('Frequency (Hz)', width / 2, height - marginBottom + 25);
        }

        // ===== TITLE LABEL =====
        ctx.fillStyle = '#ccc';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${type.toUpperCase()} Spectrum - ${scale === 'audiogram' ? 'Audiogram (Log)' : 'Linear'}`, 10, 20);

    }, [type, hasData]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
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
```

---

## 📐 Key Mathematical Formulas

### 1. Logarithmic Frequency Mapping (X-axis)
```javascript
// Convert frequency to logarithmic position
logFreq = Math.log10(frequency)
normalizedPosition = (logFreq - log10(20)) / (log10(20000) - log10(20))
xPixel = marginLeft + normalizedPosition * plotWidth

// Example calculations:
// 20 Hz   → log10(20) = 1.301   → position = 0.000 (left edge)
// 100 Hz  → log10(100) = 2.000  → position = 0.233
// 1000 Hz → log10(1000) = 3.000 → position = 0.566 (middle)
// 10k Hz  → log10(10000) = 4.000 → position = 0.900
// 20k Hz  → log10(20000) = 4.301 → position = 1.000 (right edge)
```

### 2. Decibel Conversion (Y-axis)
```javascript
// Convert linear magnitude to decibels
dB = 20 * Math.log10(magnitude)

// Why 20 and not 10?
// Power ∝ Magnitude²
// dB_power = 10 * log10(Power)
// dB_power = 10 * log10(Magnitude²)
// dB_power = 10 * 2 * log10(Magnitude)
// dB_power = 20 * log10(Magnitude)
```

### 3. Inverted Y-axis Mapping
```javascript
// Invert so louder = top, quieter = bottom
normalizedDB = maxMagnitudeDB - currentMagnitudeDB

// Map to pixel position (0 dB at top = y=marginTop, 120 dB at bottom = y=height)
dbPosition = (normalizedDB - minDB) / (maxDB - minDB)  // 0 to 1
yPixel = marginTop + dbPosition * plotHeight
```

---

## 🎨 Usage Example

```jsx
import React, { useState, useEffect } from 'react';
import FrequencyChart from './FrequencyChart';

function App() {
    const [fftData, setFftData] = useState([]);
    
    // Example: Generate sample FFT data (replace with your actual FFT output)
    useEffect(() => {
        // Simulate FFT magnitude data (1024 bins from 0 Hz to ~22050 Hz)
        const sampleData = Array.from({ length: 1024 }, (_, i) => {
            // Generate a sample spectrum with peaks at certain frequencies
            const freq = (i / 1024) * 22050;
            let magnitude = 0;
            
            // Add peaks at musical frequencies
            if (freq > 100 && freq < 300) magnitude += 0.8;  // Bass
            if (freq > 400 && freq < 600) magnitude += 0.6;  // Low mid
            if (freq > 1000 && freq < 3000) magnitude += 0.9; // Vocals
            if (freq > 5000 && freq < 8000) magnitude += 0.5; // High frequencies
            
            return magnitude + Math.random() * 0.1; // Add noise
        });
        
        setFftData(sampleData);
    }, []);
    
    return (
        <div style={{ padding: '20px', background: '#121212', minHeight: '100vh' }}>
            <h1 style={{ color: '#fff' }}>Audiogram Frequency Chart</h1>
            
            <div style={{ 
                background: '#1e1e1e', 
                padding: '20px', 
                borderRadius: '8px',
                height: '400px'
            }}>
                <FrequencyChart data={fftData} type="input" />
            </div>
        </div>
    );
}

export default App;
```

---

## 📊 Understanding the Scales

### Linear Mode vs Audiogram Mode

| Aspect | Linear Mode | Audiogram Mode |
|--------|-------------|----------------|
| **X-axis** | Linear (0 to 22050 Hz) | Logarithmic (20 to 20000 Hz) |
| **X spacing** | Equal Hz per pixel | Equal octaves per pixel |
| **Y-axis** | Linear magnitude | Decibels (dB) |
| **Y direction** | Up = louder | **Down = worse hearing** |
| **Y range** | 0 to max magnitude | -10 to 120 dB HL |
| **Visual** | Filled area | Line only with grid |
| **Use case** | General analysis | Medical/hearing assessment |

### Why Logarithmic Frequency?

Human hearing perceives **octaves** (frequency doublings) equally:
- 100 → 200 Hz (1 octave) sounds the same "distance" as
- 1000 → 2000 Hz (1 octave)

In linear scale, 1000→2000 would be 10x wider than 100→200.
In logarithmic scale, both get **equal visual width**.

### Why Inverted Y-axis?

Medical audiogram convention:
- **Top of chart** (0 dB) = **Good hearing** (normal threshold)
- **Bottom of chart** (120 dB) = **Severe hearing loss** (needs very loud sounds to hear)

This makes audiograms intuitive for doctors: line near top = healthy hearing.

---

## 🔧 Customization Options

### Change Frequency Range
```javascript
const minFreq = 50;    // Start at 50 Hz instead of 20 Hz
const maxFreq = 16000; // End at 16 kHz instead of 20 kHz
```

### Change dB Range
```javascript
const minDB = 0;   // Normal audiograms start at 0 dB
const maxDB = 100; // Some tests only go to 100 dB
```

### Add Vertical Frequency Grid Lines
```javascript
// In the audiogram drawing section, add:
const freqGridLines = [100, 500, 1000, 2000, 5000, 10000];
freqGridLines.forEach(freq => {
    const logFreq = Math.log10(freq);
    const normalizedLogPos = (logFreq - logMinFreq) / (logMaxFreq - logMinFreq);
    const x = marginLeft + normalizedLogPos * plotWidth;
    
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, marginTop);
    ctx.lineTo(x, marginTop + plotHeight);
    ctx.stroke();
});
```

### Change Colors
```javascript
// In drawChart function:
ctx.strokeStyle = '#00ff00'; // Green line
ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'; // Green fill
```

---

## 🧪 Testing with Sample Data

```javascript
// Test data generator for different scenarios
function generateTestData(type) {
    const size = 1024;
    
    switch(type) {
        case 'flat':
            // Flat spectrum (white noise)
            return Array(size).fill(0.5);
            
        case 'bass-heavy':
            // More bass frequencies
            return Array.from({ length: size }, (_, i) => {
                const freq = (i / size) * 22050;
                return freq < 200 ? 0.9 : 0.2;
            });
            
        case 'high-pass':
            // Only high frequencies
            return Array.from({ length: size }, (_, i) => {
                const freq = (i / size) * 22050;
                return freq > 2000 ? 0.8 : 0.1;
            });
            
        case 'musical':
            // Musical spectrum with harmonic peaks
            return Array.from({ length: size }, (_, i) => {
                const freq = (i / size) * 22050;
                let mag = 0.1;
                
                // Fundamental and harmonics at 220 Hz (A3)
                [220, 440, 880, 1760, 3520].forEach(harmonic => {
                    if (Math.abs(freq - harmonic) < 20) {
                        mag = 0.9;
                    }
                });
                
                return mag;
            });
            
        default:
            return Array.from({ length: size }, () => Math.random() * 0.5);
    }
}

// Usage:
<FrequencyChart data={generateTestData('musical')} type="input" />
```

---

## 📝 Dependencies

```json
{
  "dependencies": {
    "react": "^18.0.0 or ^19.0.0"
  }
}
```

No external charting libraries needed - uses native HTML5 Canvas API!

---

## 🎓 Educational Resources

To learn more about audiograms and hearing science:

1. **Audiogram Basics**: https://www.asha.org/public/hearing/audiogram/
2. **Decibel Scale**: https://en.wikipedia.org/wiki/Decibel
3. **Logarithmic Perception**: https://en.wikipedia.org/wiki/Weber%E2%80%93Fechner_law
4. **FFT Tutorial**: https://www.nti-audio.com/en/support/know-how/fast-fourier-transform-fft

---

**Created**: November 27, 2025  
**License**: MIT (free to use in any project)
