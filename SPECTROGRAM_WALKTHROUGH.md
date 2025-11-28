# 🎵 Spectrogram Mode - Complete Walkthrough
## From Backend FFT to Frontend Visualization

---

## 📋 Table of Contents
1. [What is a Spectrogram?](#what-is-a-spectrogram)
2. [Backend Implementation](#backend-implementation)
3. [API Layer](#api-layer)
4. [Frontend Integration](#frontend-integration)
5. [Data Flow Diagram](#data-flow-diagram)
6. [Code Examples](#code-examples)

---

## 🎯 What is a Spectrogram?

A **spectrogram** is a visual representation of how frequencies in a signal change over time.

### Think of it like this:
- **X-axis**: Time (when something happens)
- **Y-axis**: Frequency (what note/pitch)
- **Color**: Magnitude (how loud/strong)

### Real-world analogy:
Imagine a piano performance:
- **Time**: When each key is pressed (0s, 1s, 2s...)
- **Frequency**: Which key is pressed (low C, middle A, high E...)
- **Magnitude**: How hard the key is hit (soft vs loud)

A spectrogram shows all three at once!

---

## 🔧 Backend Implementation

### Step 1: The Math Foundation - `fft_implementation.py`

Located in: `backend/fft_implementation.py`

#### Key Functions:

```python
def rfft(x, pad=True):
    """
    Real FFT - Optimized for audio signals.
    
    Why rfft instead of full FFT?
    - Audio signals are REAL (not complex)
    - Real signals have symmetric frequency spectrum
    - We only need POSITIVE frequencies (0 Hz to Nyquist)
    - Saves 50% memory and computation!
    
    Example:
        signal = [1, 2, 3, 4, 5, 6, 7, 8]  # 8 samples
        rfft_result = rfft(signal)  # Returns 5 values (0 to Nyquist)
        full_fft = fft(signal)      # Would return 8 values
    """
```

#### How it works:

1. **Input**: Time-domain audio signal (array of numbers)
   ```
   signal = [0.5, 0.7, 0.3, -0.1, ...]
   ```

2. **Process**: Apply Cooley-Tukey FFT algorithm
   ```python
   # Recursive divide-and-conquer
   even = rfft(signal[::2])  # Process even indices
   odd = rfft(signal[1::2])  # Process odd indices
   # Combine using "twiddle factors" (complex exponentials)
   ```

3. **Output**: Frequency-domain data (complex numbers)
   ```
   freq_data = [2.5+0j, 1.2+0.8j, 0.5-0.3j, ...]
   ```

Each complex number has:
- **Magnitude**: How strong this frequency is (|1.2+0.8j| = √(1.2² + 0.8²) = 1.44)
- **Phase**: The timing/offset of this frequency (not used in spectrograms)

---

### Step 2: Building the Spectrogram - `main.py` API endpoint

Located in: `main.py` → `/api/spectrogram/input`

#### The Algorithm (Detailed):

```python
@app.get("/api/spectrogram/input")
async def get_input_spectrogram(session_id: str, window_size: int = 1024, overlap: float = 0.75):
```

#### Breaking it down:

**A. Setup Parameters**
```python
signal = processor.original_data  # e.g., [0.5, 0.7, 0.3, -0.1, ...]
sample_rate = 44100  # Standard audio: 44,100 samples per second
window_size = 1024   # How many samples per "slice"
overlap = 0.75       # 75% overlap between slices
```

**Why these numbers?**
- **44,100 Hz**: Human hearing range (20 Hz - 20 kHz) × 2 (Nyquist theorem)
- **1024 samples**: Good frequency resolution (44100/1024 = 43 Hz per bin)
- **75% overlap**: Smooth transitions between time slices

**B. Calculate Number of Slices**
```python
hop_size = int(window_size * (1 - overlap))  # 1024 * 0.25 = 256
num_windows = (len(signal) - window_size) // hop_size + 1
```

Example:
- Signal length: 88,200 samples (2 seconds at 44.1 kHz)
- Window size: 1024
- Hop size: 256
- Number of slices: (88200 - 1024) / 256 + 1 = 341 slices

**C. Process Each Time Slice**
```python
for i in range(num_windows):
    # 1. Extract time window
    start = i * hop_size       # e.g., 0, 256, 512, 768...
    end = start + window_size  # e.g., 1024, 1280, 1536...
    window = signal[start:end] # Get this slice
```

**Visual representation:**
```
Signal:  [------------------------------------------------]
         ^-----------^           Window 1 (0 to 1024)
                ^-----------^    Window 2 (256 to 1280)
                       ^-----------^  Window 3 (512 to 1536)
```

**D. Apply Hann Window (Smoothing)**
```python
    # 2. Apply Hann window
    hann = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(window_size) / window_size)
    windowed = window * hann
```

**What is Hann window?**
- Bell-shaped curve that fades edges to zero
- Prevents "spectral leakage" (artifacts from sharp cuts)

**Visual:**
```
Original:   |-----------| (sharp edges cause artifacts)
Hann:       /‾‾‾‾‾‾‾‾‾\  (smooth edges, cleaner FFT)
```

**E. Compute FFT for This Slice**
```python
    # 3. FFT - convert to frequency domain
    fft_result = rfft(windowed, pad=False)  # Complex numbers
    magnitude = np.abs(fft_result)          # Only need strength
```

**What happens:**
- Input: 1024 time samples → Output: 513 frequency bins
- Each bin represents a frequency range (43 Hz wide)
- Magnitude tells us how strong each frequency is

**F. Store Results**
```python
    # 4. Store (reversed for proper visualization)
    spectrogram.append(magnitude[::-1].tolist())  # Reverse so low freq at bottom
    times.append(start / sample_rate)             # Time stamp of this slice
```

**G. Create Frequency Axis**
```python
# 5. Frequency bins
frequencies = rfftfreq(window_size, 1/sample_rate)[::-1]
```

Generates: [0, 43, 86, 129, ..., 22050] Hz (reversed for display)

---

### Step 3: The Complete Flow

```
INPUT SIGNAL (Time Domain)
    │
    ├─> Slice 1: [samples 0-1024]
    │   ├─> Apply Hann window
    │   ├─> FFT → 513 frequency bins
    │   └─> Store magnitudes [low...high]
    │
    ├─> Slice 2: [samples 256-1280] (75% overlap)
    │   ├─> Apply Hann window
    │   ├─> FFT → 513 frequency bins
    │   └─> Store magnitudes
    │
    ├─> Slice 3: [samples 512-1536]
    │   ... (repeat)
    │
    └─> Slice N: [samples X-Y]

RESULT: 2D Array (Spectrogram)
    - Rows: Time slices (341 slices)
    - Columns: Frequency bins (513 bins)
    - Values: Magnitude (0.0 to 1.0+)
```

---

## 🌐 API Layer

### Endpoint: `GET /api/spectrogram/input`

**Request:**
```http
GET http://localhost:8000/api/spectrogram/input?session_id=abc123&window_size=1024&overlap=0.75
```

**Response:**
```json
{
  "times": [0.0, 0.0058, 0.0116, 0.0174, ...],  // Time stamps (seconds)
  "frequencies": [22050, 21963, 21876, ...],    // Frequency bins (Hz, reversed)
  "magnitude": [                                 // 2D array [time][frequency]
    [0.001, 0.002, 0.015, ...],  // Slice 1
    [0.001, 0.003, 0.020, ...],  // Slice 2
    [0.002, 0.004, 0.018, ...],  // Slice 3
    ...
  ],
  "sample_rate": 44100
}
```

**Data Structure:**
```
magnitude[timeIndex][frequencyIndex] = strength

Example:
magnitude[50][200] = 0.85  // At time slice 50, frequency bin 200 has magnitude 0.85
```

---

## 🎨 Frontend Integration

### React Component: `SpectrogramView.jsx`

Located in: `testfront/src/components/SpectrogramView.jsx`

#### Key Parts:

**1. Fetch Data from API**
```javascript
const fetchSpectrogram = async () => {
  const response = await fetch(
    `http://localhost:8000/api/spectrogram/input?session_id=${sessionId}`
  );
  const data = await response.json();
  // data = { times: [...], frequencies: [...], magnitude: [[...], [...]] }
};
```

**2. Draw on Canvas**
```javascript
const drawSpectrogram = (data) => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  
  // For each time slice
  for (let t = 0; t < data.times.length; t++) {
    // For each frequency bin
    for (let f = 0; f < data.frequencies.length; f++) {
      const magnitude = data.magnitude[t][f];
      
      // Map magnitude to color (0.0 = dark blue, 1.0 = bright yellow)
      const color = magnitudeToColor(magnitude);
      
      // Draw pixel
      ctx.fillStyle = color;
      ctx.fillRect(x_position, y_position, pixel_width, pixel_height);
    }
  }
};
```

**3. Color Mapping**
```javascript
const magnitudeToColor = (magnitude) => {
  // Example: Viridis colormap
  if (magnitude < 0.2) return 'rgb(68, 1, 84)';    // Dark purple
  if (magnitude < 0.4) return 'rgb(59, 82, 139)';  // Blue
  if (magnitude < 0.6) return 'rgb(33, 145, 140)'; // Teal
  if (magnitude < 0.8) return 'rgb(94, 201, 98)';  // Green
  return 'rgb(253, 231, 37)';                       // Bright yellow
};
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER CREATES SIGNAL                      │
│        (Upload file OR Generate synthetic signal)           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               BACKEND: main.py (FastAPI)                    │
│  • Session created: sessions[session_id] = SignalProcessor  │
│  • Signal stored: processor.original_data = [samples...]    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ User switches to Spectrogram mode
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           FRONTEND: SpectrogramView.jsx                     │
│  • Calls: GET /api/spectrogram/input?session_id=xxx        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          BACKEND: get_input_spectrogram()                   │
│                                                             │
│  1. Get signal from session:                               │
│     signal = sessions[session_id].original_data            │
│                                                             │
│  2. Setup parameters:                                       │
│     window_size = 1024                                      │
│     hop_size = 256 (75% overlap)                           │
│                                                             │
│  3. Loop through time windows:                             │
│     for i in range(num_windows):                           │
│       • Extract slice: window = signal[i*256 : i*256+1024]│
│       • Apply Hann smoothing                               │
│       • Compute FFT: rfft(window) → 513 freq bins         │
│       • Get magnitude: abs(fft_result)                     │
│       • Store: spectrogram.append(magnitude)               │
│                                                             │
│  4. Create frequency axis:                                 │
│     frequencies = [0, 43, 86, ..., 22050] Hz              │
│                                                             │
│  5. Create time axis:                                       │
│     times = [0, 0.0058, 0.0116, ...] seconds              │
│                                                             │
│  6. Return JSON:                                           │
│     { times: [...], frequencies: [...], magnitude: [...] }│
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│    BACKEND: fft_implementation.py - rfft()                  │
│                                                             │
│  • Input: 1024 real samples (time domain)                  │
│  • Process: Cooley-Tukey FFT algorithm                     │
│    - Recursively split into even/odd                       │
│    - Apply twiddle factors (complex exponentials)          │
│    - Combine results                                        │
│  • Output: 513 complex numbers (frequency domain)          │
│    [DC, bin1, bin2, ..., Nyquist]                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   API RESPONSE (JSON)                       │
│                                                             │
│  {                                                          │
│    "times": [0, 0.0058, 0.0116, ...],      // 341 items    │
│    "frequencies": [22050, 21963, ...],     // 513 items    │
│    "magnitude": [                          // 341×513 matrix│
│      [0.001, 0.002, 0.015, ...],          // Time slice 0 │
│      [0.001, 0.003, 0.020, ...],          // Time slice 1 │
│      ...                                                    │
│    ],                                                       │
│    "sample_rate": 44100                                     │
│  }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│       FRONTEND: SpectrogramView.jsx - Render                │
│                                                             │
│  1. Receive JSON data                                       │
│  2. Get canvas element                                      │
│  3. Calculate pixel dimensions:                             │
│     pixel_width = canvas_width / num_time_slices           │
│     pixel_height = canvas_height / num_freq_bins           │
│  4. Loop through data:                                      │
│     for (t = 0; t < times.length; t++) {                   │
│       for (f = 0; f < frequencies.length; f++) {           │
│         magnitude = data.magnitude[t][f]                    │
│         color = mapToColor(magnitude)  // Viridis/Jet      │
│         drawPixel(x=t*width, y=f*height, color)            │
│       }                                                      │
│     }                                                        │
│  5. Draw axes labels (time and frequency)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  VISUAL DISPLAY                             │
│                                                             │
│         SPECTROGRAM                                         │
│  Freq  ┌────────────────────┐                              │
│  (Hz)  │░░▒▒▓▓██▓▓▒▒░░▒▒▓▓│  ← Each pixel = magnitude     │
│ 20000  │░░░░▒▒▒▒▓▓▒▒░░░░░░│     at (time, frequency)      │
│ 15000  │▒▒▓▓██████▓▓▒▒░░░░│                                │
│ 10000  │▓▓████████████▓▓▒▒│  Colors:                       │
│  5000  │██████████████████│  ░ = weak (quiet)              │
│     0  │▒▒▓▓██████▓▓▒▒░░░░│  █ = strong (loud)             │
│        └────────────────────┘                               │
│          0s    1s    2s  (Time)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Code Examples

### Example 1: Understanding the FFT Window Loop

```python
# Simplified spectrogram calculation
signal = [... 88,200 samples ...]  # 2 seconds of audio
window_size = 1024
hop_size = 256

spectrogram = []

# Process first 3 windows
# Window 1: samples 0-1024
window1 = signal[0:1024]
fft1 = rfft(window1)  # → 513 frequency bins
spectrogram.append(abs(fft1))  # Store magnitudes

# Window 2: samples 256-1280 (overlap with window 1)
window2 = signal[256:1280]
fft2 = rfft(window2)
spectrogram.append(abs(fft2))

# Window 3: samples 512-1536
window3 = signal[512:1536]
fft3 = rfft(window3)
spectrogram.append(abs(fft3))

# ... repeat for all windows

# Result: spectrogram[time_index][frequency_index] = magnitude
print(spectrogram[0][100])  # Magnitude at time=0, freq bin=100
print(spectrogram[1][100])  # Magnitude at time=256, freq bin=100
```

### Example 2: Interpreting Spectrogram Data

```python
# Example response from API
data = {
  "times": [0.0, 0.0058, 0.0116, ...],
  "frequencies": [0, 43, 86, 129, ...],
  "magnitude": [
    [0.001, 0.050, 0.800, 0.050, ...],  # Time slice 0
    [0.001, 0.060, 0.750, 0.045, ...],  # Time slice 1
    ...
  ]
}

# What does this mean?
# At time 0s, frequency 86 Hz has magnitude 0.800 (strong signal)
# At time 0.0058s, frequency 86 Hz has magnitude 0.750 (slightly weaker)

# Find the loudest frequency at time slice 0
loudest_freq_index = data["magnitude"][0].index(max(data["magnitude"][0]))
loudest_frequency = data["frequencies"][loudest_freq_index]
print(f"Loudest frequency at t=0: {loudest_frequency} Hz")
```

### Example 3: Color Mapping Logic

```javascript
// Frontend visualization
function magnitudeToRGB(magnitude) {
  // Simple Jet colormap: Blue → Cyan → Yellow → Red
  
  if (magnitude < 0.25) {
    // Blue to Cyan
    const t = magnitude / 0.25;
    return `rgb(0, ${Math.floor(t * 255)}, 255)`;
  }
  else if (magnitude < 0.5) {
    // Cyan to Green
    const t = (magnitude - 0.25) / 0.25;
    return `rgb(0, 255, ${Math.floor((1 - t) * 255)})`;
  }
  else if (magnitude < 0.75) {
    // Green to Yellow
    const t = (magnitude - 0.5) / 0.25;
    return `rgb(${Math.floor(t * 255)}, 255, 0)`;
  }
  else {
    // Yellow to Red
    const t = (magnitude - 0.75) / 0.25;
    return `rgb(255, ${Math.floor((1 - t) * 255)}, 0)`;
  }
}
```

---

## 🎓 Key Concepts Summary

### 1. **Why Overlap Windows?**
Without overlap, abrupt boundaries between windows create artifacts. 75% overlap ensures smooth transitions.

### 2. **Why Hann Window?**
Sharp edges in time-domain windows cause "spectral leakage" (frequency smearing). Hann window smoothly fades edges to zero.

### 3. **Why rfft Instead of Full FFT?**
Audio signals are real (not complex), so the frequency spectrum is symmetric. We only need positive frequencies (0 to Nyquist), saving 50% computation.

### 4. **What Do the Colors Mean?**
- **Dark colors (blue/purple)**: Weak/quiet frequencies
- **Bright colors (yellow/red)**: Strong/loud frequencies
- **Horizontal lines**: Sustained tones (constant frequency)
- **Vertical streaks**: Transients (drum hits, clicks)

### 5. **Time vs Frequency Resolution Trade-off**
- **Larger window (2048)**: Better frequency resolution, worse time resolution
- **Smaller window (512)**: Better time resolution, worse frequency resolution
- **Standard (1024)**: Balanced for most music/speech applications

---

## 🔍 Debugging Tips

### Issue 1: Spectrogram is all dark
- **Cause**: Signal too quiet or incorrect normalization
- **Fix**: Check signal amplitude, try converting to dB scale (20*log10(magnitude))

### Issue 2: Spectrogram shows wrong frequencies
- **Cause**: Reversed frequency axis or incorrect sample rate
- **Fix**: Verify rfftfreq calculation, check if frequencies need reversing for display

### Issue 3: Spectrogram has horizontal stripes
- **Cause**: Insufficient overlap or missing Hann window
- **Fix**: Increase overlap to 75%, ensure Hann window is applied

### Issue 4: Spectrogram is blurry
- **Cause**: Window size too large for signal characteristics
- **Fix**: Try smaller window (512 instead of 1024) for better time resolution

---

## ✅ Testing Checklist

- [ ] Backend returns 2D array with correct dimensions
- [ ] Frequency axis ranges from 0 Hz to Nyquist (sample_rate/2)
- [ ] Time axis matches signal duration
- [ ] Colors reflect magnitude correctly (bright = loud, dark = quiet)
- [ ] Known frequencies appear as horizontal lines
- [ ] Different signals produce different spectrograms
- [ ] Resizing window/overlap updates visualization

---

## 🚀 Next Steps

Now that you understand spectrograms, explore:
1. **Output Spectrogram**: Compare before/after signal processing
2. **Interactive Features**: Click to play specific time ranges
3. **Frequency Highlighting**: Show which sliders affect which frequencies
4. **Real-time Updates**: Live spectrogram during audio playback

---

**Questions?** Review the code in:
- Backend FFT: `backend/fft_implementation.py`
- API endpoints: `main.py` (lines 398-526)
- Frontend component: `testfront/src/components/SpectrogramView.jsx`
