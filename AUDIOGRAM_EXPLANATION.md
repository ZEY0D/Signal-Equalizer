# Frequency Chart: Linear vs Audiogram Modes

## Simple Explanation

### **Linear Mode** (Standard FFT Visualization)
This is like a regular graph where everything is evenly spaced.

**X-Axis (Horizontal):**
- Shows frequency from 0 Hz to ~22050 Hz (Nyquist frequency)
- **Linear spacing**: Each pixel represents the same frequency step
- Example: If width is 1000 pixels, each pixel = 22 Hz
  - Pixel 0 = 0 Hz
  - Pixel 100 = 2,200 Hz
  - Pixel 200 = 4,400 Hz (100 more pixels = 2,200 Hz more)

**Y-Axis (Vertical):**
- Shows magnitude (how strong that frequency is)
- **Linear scale**: Taller = louder/stronger
- Goes from 0 (bottom) to maximum magnitude (top)
- Normalized to 0-1 range

**Visual:**
- Filled area under the curve (colored)
- Good for seeing ALL frequencies equally


### **Audiogram Mode** (Medical Hearing Test)
This is how doctors test your hearing - designed to match how humans actually hear.

**X-Axis (Horizontal):**
- Shows frequency from 20 Hz to 20,000 Hz (human hearing range)
- **Logarithmic spacing**: Each octave (doubling) gets equal space
- Example spacing:
  - 20 Hz → 50 Hz → 100 Hz → 200 Hz → 500 Hz → 1 kHz → 2 kHz → 5 kHz → 10 kHz → 20 kHz
  - Notice: 100→200 is same visual distance as 1000→2000 (both are "doubling")

**Why logarithmic?**
Humans hear in octaves, not linear steps. The jump from 100 Hz to 200 Hz sounds the same as 1000 Hz to 2000 Hz (both are one octave).

**Y-Axis (Vertical):**
- Shows "Hearing Level" in **decibels (dB HL)**
- **INVERTED scale** (upside down!):
  - **0 dB at TOP** = Normal hearing (good!)
  - **120 dB at BOTTOM** = Severe hearing loss (bad!)
- Grid lines every 10 dB

**Why inverted?**
Medical convention: Better hearing = higher on chart (closer to top). This makes audiograms easy for doctors to read: if the line is near the top, hearing is good.

**Visual:**
- Line plot only (no fill)
- Grid with dB labels
- Frequency labels at standard audiogram points


## Technical Details

### Logarithmic X-Axis Formula:
```javascript
// Convert frequency to logarithmic position
logFreq = log10(frequency)
position = (logFreq - log10(20)) / (log10(20000) - log10(20))
position_pixels = position * width

// Example: Where does 1000 Hz appear?
log10(1000) = 3.0
log10(20) = 1.301
log10(20000) = 4.301
position = (3.0 - 1.301) / (4.301 - 1.301) = 1.699 / 3.0 = 0.566
// So 1000 Hz appears at 56.6% across the width
```

### dB Conversion Formula:
```javascript
// Convert linear magnitude to decibels
dB = 20 * log10(magnitude)

// Why 20 and not 10?
// Power ∝ Magnitude²
// 10 * log10(Magnitude²) = 10 * 2 * log10(Magnitude) = 20 * log10(Magnitude)
```

### Inverted Y-Axis Formula:
```javascript
// Higher magnitude = less hearing loss = closer to top
normalizedDB = maxMagnitudeDB - currentMagnitudeDB
position = (normalizedDB - (-10)) / (120 - (-10))
y_pixels = marginTop + position * plotHeight

// Example: Loud sound (low hearing loss)
// maxDB = 80, currentDB = 80
// normalized = 80 - 80 = 0 dB → appears at TOP
// Quiet sound (high hearing loss)
// maxDB = 80, currentDB = 20  
// normalized = 80 - 20 = 60 dB → appears lower on chart
```


## Key Differences Summary

| Feature | Linear Mode | Audiogram Mode |
|---------|------------|----------------|
| **X-Axis** | Linear (equal spacing) | Logarithmic (octaves equal) |
| **Y-Axis** | Linear magnitude | Decibels (dB), INVERTED |
| **Y Direction** | Up = louder | Down = worse hearing |
| **Frequency Range** | 0 to Nyquist (~22 kHz) | 20 Hz to 20 kHz |
| **Visual** | Filled area | Line only |
| **Grid** | None | Horizontal dB lines |
| **Use Case** | General FFT analysis | Hearing assessment |


## When to Use Each Mode?

**Use Linear Mode:**
- General frequency analysis
- Seeing all frequencies equally
- Scientific/engineering work
- When you care about exact frequency bins

**Use Audiogram Mode:**
- Hearing health applications
- Matching human perception
- Medical/clinical use
- When low frequencies are important (more visible)


## Real-World Example

Imagine a musical note A4 (440 Hz) and its octaves:

**Linear Mode:**
- A3 (220 Hz) → A4 (440 Hz) → A5 (880 Hz) → A6 (1760 Hz)
- Spacing: 220 units → 440 units → 880 units
- Each octave gets WIDER on screen

**Audiogram Mode:**
- A3 (220 Hz) → A4 (440 Hz) → A5 (880 Hz) → A6 (1760 Hz)
- Spacing: Equal visual distance for each octave
- Matches how we hear: each octave "feels" the same


## Code Location
The implementation is in `src/App.jsx`, lines 395-570 (FrequencyChart component).
Toggle between modes by clicking the "Scale: Linear/Audiogram" button in the top-right corner of each frequency chart.
