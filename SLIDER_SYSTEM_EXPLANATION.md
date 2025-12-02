# 🎚️ Complete Guide to the Equalizer Slider System

## Table of Contents
1. [Overview](#overview)
2. [Slider Component Architecture](#slider-component-architecture)
3. [Mode Configuration](#mode-configuration)
4. [Slider Value System](#slider-value-system)
5. [Data Flow](#data-flow)
6. [Backend Processing](#backend-processing)
7. [Gain Array Creation](#gain-array-creation)
8. [Two Operating Modes](#two-operating-modes)
9. [Mathematical Formulas](#mathematical-formulas)
10. [Visual Examples](#visual-examples)

---

## Overview

The equalizer uses **vertical sliders** to control frequency bands. Each slider represents a specific frequency range (like drums, bass, vocals, or specific Hz ranges). When you move a slider, you're adjusting the **gain** (volume/amplitude) for that frequency range.

**Key Concept:** Sliders don't directly modify the audio - they just update values. The actual processing happens when you click **"Apply Changes"**.

---

## Slider Component Architecture

### Component Location
**File:** `music-eq-frontend/src/components/EqualizerSliders.jsx`

### Component Structure

```jsx
const EqualizerSliders = ({ labels, onChange, disabled }) => {
    // State to hold the current gain value for each slider (0 is default/center)
    const [gains, setGains] = React.useState(labels.map(() => 0));

    // Handle change for a specific slider
    const handleSliderInput = (index, event) => {
        const newGains = [...gains];
        const value = parseFloat(event.target.value);
        newGains[index] = value;
        setGains(newGains);
        // Call the parent handler with the index and the new gain value
        onChange(index, value); 
    };
```

### Slider Properties

```jsx
<input
    type="range"
    min="-40"        // Minimum: -40 dB (near silence)
    max="20"         // Maximum: +20 dB (10× louder)
    step="0.5"       // Fine control (0.5 dB increments)
    value={gains[index]}
    onChange={(e) => handleSliderInput(index, e)}
    style={inputStyle}
    disabled={disabled}
/>
```

### Visual Feedback

```jsx
<span style={{ 
    color: gains[index] > 0 ? '#00ff88' : // Green for boost
           gains[index] < 0 ? '#ff6b6b' : // Red for cut
           '#fff',                         // White for 0 dB
    fontWeight: 'bold'
}}>
    {gains[index].toFixed(1)} dB
</span>
```

**Color System:**
- **Green (#00ff88):** Positive gain (boost) - makes frequencies louder
- **Red (#ff6b6b):** Negative gain (cut) - makes frequencies quieter
- **White (#fff):** 0 dB (no change) - original volume

---

## Mode Configuration

### Three Modes Available

**Location:** `music-eq-frontend/src/App.jsx` (lines 14-42)

```jsx
const MODES_CONFIG = {
  music: {
    labels: ["Drums", "Bass", "Vocals", "Piano"],
    ranges: [
      [30, 260],      // Drums: 30-260 Hz
      [45, 230],      // Bass: 45-230 Hz
      [630, 1000],    // Vocals: 630-1000 Hz
      [313, 620],     // Piano: 313-620 Hz
    ],
  },
  animals: {
    labels: ["Lion", "Bird", "Cat", "Dog"],
    ranges: [
      [5.2, 210.5],       // Lion: deep roar
      [4000.09, 5650.95], // Bird: high pitch chirps
      [1212.0, 1600.0],   // Cat: meow
      [400.0, 1200.0],    // Dog: bark
    ],
  },
  human: {
    labels: ["Voice 1", "Voice 2", "Voice 3", "Voice 4"],
    ranges: [
      [60, 250],      // Low voice (bass)
      [250, 500],     // Mid-low voice
      [500, 2000],    // Mid-high voice
      [2000, 20000],  // High voice (treble)
    ],
  },
};
```

### How Slider Parameters Are Calculated

```jsx
const getModeConfig = (mode) => {
  const config = MODES_CONFIG[mode];
  
  const initialSliders = config.ranges.map((range) => {
    const [start, end] = range;
    const center_freq = (start + end) / 2;  // Middle of the range
    const width = end - start;               // Bandwidth
    return {
      center_freq: center_freq,  // Hz
      width: width,               // Hz
      gain: 0,                    // 0 dB = no change
    };
  });

  return {
    labels: config.labels,
    initialSliders: initialSliders,
  };
};
```

**Example for Music Mode - Drums Slider:**
- Range: [30, 260] Hz
- Center frequency: (30 + 260) / 2 = **145 Hz**
- Width: 260 - 30 = **230 Hz**
- Initial gain: **0 dB** (no change)

---

## Slider Value System

### Decibel (dB) Scale

The sliders use **decibels (dB)**, which is a logarithmic scale commonly used in audio:

| dB Value | Meaning | Linear Multiplier | Volume Change |
|----------|---------|-------------------|---------------|
| **+20 dB** | Maximum boost | 10.0× | 10 times louder |
| **+12 dB** | Strong boost | 4.0× | 4 times louder |
| **+6 dB** | Moderate boost | 2.0× | 2 times louder |
| **+3 dB** | Slight boost | 1.41× | ~40% louder |
| **0 dB** | No change | 1.0× | Original volume |
| **-3 dB** | Slight cut | 0.71× | ~30% quieter |
| **-6 dB** | Moderate cut | 0.5× | Half volume |
| **-12 dB** | Strong cut | 0.25× | Quarter volume |
| **-20 dB** | Very quiet | 0.1× | 10% volume |
| **-40 dB** | Near silence | 0.01× | 1% volume (mute) |

### Why Decibels?

1. **Matches Human Hearing:** Our ears perceive volume logarithmically
2. **Industry Standard:** All audio software uses dB
3. **Wide Range:** Can represent both tiny and huge changes
4. **Additive:** +6 dB + +6 dB = +12 dB

---

## Data Flow

### Step 1: User Moves Slider

```
User drags slider ↓
    ↓
EqualizerSliders.handleSliderInput()
    ↓
Updates local state: setGains([...])
    ↓
Calls parent: onChange(index, value)
    ↓
App.handleSliderChange(idx, linearGain)
    ↓
Updates slidersConfig state
    ↓
Sends to backend: updateSlidersBackend() [OPTIONAL - just saves state]
```

**At this point:** NO audio processing happens! The slider just updates:
- Frontend React state (instant visual feedback)
- Backend temporary storage (for when user clicks "Apply Changes")

### Step 2: User Clicks "Apply Changes"

```
User clicks button ↓
    ↓
App.handleApplyChanges()
    ↓
Sends POST /api/process with slider config
    ↓
Backend: process_signal()
    ↓
Backend: create_gain_array_from_sliders()
    ↓
Applies FFT → Gain → IFFT
    ↓
Returns processed audio
    ↓
Frontend updates audio player & visualizations
```

### Complete Data Structure

**Frontend sends to backend:**

```javascript
{
  session_id: "abc123...",
  sliders: [
    {
      center_freq: 145,    // Hz (drums)
      width: 230,          // Hz
      gain: -12            // dB
    },
    {
      center_freq: 137.5,  // Hz (bass)
      width: 185,          // Hz
      gain: 6              // dB
    },
    {
      center_freq: 815,    // Hz (vocals)
      width: 370,          // Hz
      gain: 3              // dB
    },
    {
      center_freq: 466.5,  // Hz (piano)
      width: 307,          // Hz
      gain: 0              // dB (no change)
    }
  ]
}
```

---

## Backend Processing

### Entry Point: `/api/process`

**File:** `music-eq-backend/main.py` (lines 431-498)

```python
@app.post("/api/process", response_model=ProcessResponse)
async def process_signal(request: ProcessRequest):
    """
    Applies gain from sliders and reconstructs the signal.
    Uses the ALREADY COMPUTED FFT (no recomputation!).
    """
    processor = await get_session(request.session_id)
    
    # Get slider configuration
    slider_list = [s.model_dump() for s in request.sliders]
    
    # Debug: Print slider configuration
    print("\n" + "="*60)
    print("🎛️  APPLYING SLIDERS (FFT→Gain→IFFT):")
    for i, slider in enumerate(slider_list):
        print(f"   [{i}] Center: {slider['center_freq']:.1f} Hz, "
              f"Width: {slider['width']:.1f} Hz, Gain: {slider['gain']:.2f}")
    
    # CREATE GAIN ARRAY FROM SLIDERS (This is the magic!)
    gain_array = processor.create_gain_array_from_sliders(slider_list)
    
    # Apply gain (uses cached FFT)
    modified_freq_domain = processor.apply_frequency_gain(gain_array)
    
    # Reconstruct signal (IFFT happens here)
    output_signal = processor.reconstruct_signal()
    
    return { ... }
```

---

## Gain Array Creation

### The Core Algorithm

**File:** `music-eq-backend/backend/equalizer_core.py` (lines 452-567)

This is the **most important function** - it converts slider values into a gain array that can be applied to the FFT.

### Two Operating Modes Detection

```python
def create_gain_array_from_sliders(self, slider_list):
    # Gather raw gains to decide convention
    raw_gains = [float(slider['gain']) for slider in slider_list]
    
    # Auto-detect mode:
    # If all gains are in [0.0, 3.0] → GENERIC mode (linear multipliers)
    # Otherwise → CUSTOMIZED mode (dB values)
    if all((g >= 0.0 and g <= 3.0) for g in raw_gains):
        detected = 'generic'
    else:
        detected = 'customized'
```

---

## Two Operating Modes

### Mode 1: GENERIC (Linear Multipliers)

**Used when:** Slider values are between 0.0 and 3.0

**Behavior:** Sliders **cascade** (multiply together)

```python
# Start with unity gain (1.0) everywhere
gain_array = np.ones(n, dtype=float)

for slider in slider_list:
    linear_gain = float(slider['gain'])  # e.g., 1.5
    center = float(slider['center_freq'])
    width = float(slider['width'])
    
    # Apply smooth bell curve
    for idx, freq in enumerate(freqs):
        distance = abs(freq - center)
        if distance <= effective_range:
            normalized_dist = distance / effective_range
            bell_curve = 0.5 * (1.0 + np.cos(np.pi * normalized_dist))
            effective_gain = 1.0 + (linear_gain - 1.0) * bell_curve
            gain_array[idx] *= effective_gain  # MULTIPLY (cascade)
```

**Example:**
- Slider 1 at 100 Hz: 1.5× gain
- Slider 2 at 120 Hz: 0.8× gain
- Frequency at 110 Hz (middle): 1.5 × 0.8 = **1.2× final gain**

### Mode 2: CUSTOMIZED (Decibel Values)

**Used when:** Slider values are outside [0.0, 3.0] (i.e., dB values like -40 to +20)

**Behavior:** Sliders use **max blending** (highest gain wins)

```python
# Start with zero gain everywhere
gain_array = np.zeros(n, dtype=float)

for slider in slider_list:
    gain_db = float(slider['gain'])  # e.g., -12 dB
    
    # Convert dB to linear: 10^(dB/20)
    if gain_db <= -60.0:
        gain_linear = 0.0
    else:
        gain_linear = 10 ** (gain_db / 20.0)
    
    center = float(slider['center_freq'])
    width = float(slider['width'])
    
    # Calculate frequency range
    freq_min = center - width / 2.0
    freq_max = center + width / 2.0
    transition = max(10.0, width * 0.1)
    
    for idx, freq in enumerate(freqs):
        # Inside main band: use full gain
        if freq_min <= freq <= freq_max:
            gain_array[idx] = max(gain_array[idx], gain_linear)  # MAX (blend)
        
        # Transition zones (smooth edges)
        elif freq_min - transition <= freq < freq_min:
            # Left edge: smooth fade-in
            alpha = (freq - (freq_min - transition)) / transition
            blend = 0.5 - 0.5 * np.cos(np.pi * alpha)
            gain_array[idx] = max(gain_array[idx], gain_linear * blend)
        
        elif freq_max < freq <= freq_max + transition:
            # Right edge: smooth fade-out
            alpha = (freq - freq_max) / transition
            blend = 0.5 + 0.5 * np.cos(np.pi * alpha)
            gain_array[idx] = max(gain_array[idx], gain_linear * blend)
```

**Example:**
- Slider 1 (Drums): -12 dB at 145 Hz → 0.25× linear
- Slider 2 (Bass): +6 dB at 137 Hz → 2.0× linear
- Frequency at 140 Hz (overlap): max(0.25, 2.0) = **2.0× final gain** (bass wins)

---

## Mathematical Formulas

### dB to Linear Conversion

```
linear_gain = 10^(dB / 20)
```

**Examples:**
```python
+20 dB → 10^(20/20) = 10^1 = 10.0×
+6 dB  → 10^(6/20)  = 10^0.3 ≈ 2.0×
0 dB   → 10^(0/20)  = 10^0 = 1.0×
-6 dB  → 10^(-6/20) = 10^-0.3 ≈ 0.5×
-20 dB → 10^(-20/20) = 10^-1 = 0.1×
-40 dB → 10^(-40/20) = 10^-2 = 0.01×
```

### Bell Curve (Smooth Transition)

For frequencies near the slider's center:

```python
# Calculate distance from center
normalized_dist = distance / effective_range  # 0.0 to 1.0

# Apply cosine bell curve
bell_curve = 0.5 * (1.0 + np.cos(π * normalized_dist))
```

**Bell curve values:**
- At center (distance = 0): bell_curve = 1.0 (full gain)
- At half range: bell_curve ≈ 0.5 (half gain)
- At edge: bell_curve = 0.0 (no gain)

### Smooth Transition Zones

For frequencies outside the main band but within transition zone:

```python
# Fade-in (left edge)
alpha = (freq - (freq_min - transition)) / transition
blend = 0.5 - 0.5 * cos(π * alpha)

# Fade-out (right edge)
alpha = (freq - freq_max) / transition
blend = 0.5 + 0.5 * cos(π * alpha)
```

---

## Visual Examples

### Example 1: Music Mode - Boosting Vocals

**Slider Configuration:**
```
Drums:  -10 dB (cut)
Bass:   -5 dB (slight cut)
Vocals: +8 dB (boost) ← Main focus
Piano:  0 dB (no change)
```

**Frequency Response Graph:**
```
Gain
 ↑
10×  |
     |
 2×  |               ╱‾‾╲     ← Vocals boosted
     |              ╱    ╲
 1×  |─────────────╱──────╲─────  ← Piano unchanged
     |            /        \
0.5× |     ╲___╱            
     |      ╲_╱              ← Drums & Bass cut
0.1× |_____|_____|_____|_____|_____→
     0    100   400   800  1200   Frequency (Hz)
         Drums Bass Vocals Piano
```

### Example 2: Overlapping Sliders (Customized Mode)

**Slider Configuration:**
```
Slider 1: Center 200 Hz, Width 100 Hz, Gain +10 dB
Slider 2: Center 250 Hz, Width 100 Hz, Gain +5 dB
```

**Frequency Response:**
```
Gain
 ↑
3.16×|      ╱‾╲        ← +10 dB peak
     |     ╱   ╲
1.78×|    ╱     ╲╱‾╲  ← +5 dB peak
     |   ╱        ╲
 1×  |__╱          ╲__
     |__|___|___|___|__→
     150 200 250 300 350  Frequency (Hz)
```

**Key:** At 225 Hz (overlap zone), the gain is **max(3.16, 1.78) = 3.16×** (+10 dB wins)

### Example 3: Isolating One Stem (Demucs Mode)

**Goal:** Hear only vocals, mute everything else

**Slider Configuration:**
```
Drums:  -40 dB (mute)
Bass:   -40 dB (mute)
Vocals:  +5 dB (boost slightly)
Piano:  -40 dB (mute)
```

**Result:** Only the vocals stem is audible at 1.78× volume

---

## Practical Usage Guide

### Scenario 1: Remove Drums from Music

```
1. Upload music file
2. Set Drums slider to -40 dB (far left)
3. Keep other sliders at 0 dB
4. Click "Apply Changes"
Result: Music without drums
```

### Scenario 2: Boost Bass for Better Sound

```
1. Upload music file
2. Set Bass slider to +6 dB
3. Keep other sliders at 0 dB
4. Click "Apply Changes"
Result: Bass frequencies doubled in volume
```

### Scenario 3: Make Karaoke Track (Remove Vocals)

```
1. Upload music file
2. Click "Separate with AI" (Demucs)
3. Wait for separation
4. Set sliders:
   - Drums: 0 dB
   - Bass: 0 dB
   - Vocals: -40 dB ← Mute vocals
   - Piano: 0 dB
5. Click "Mix Stems"
Result: Music without vocals (karaoke track!)
```

### Scenario 4: Create Custom Mix

```
1. Upload music file
2. Click "Separate with AI"
3. Set sliders:
   - Drums: +3 dB (slightly louder)
   - Bass: -6 dB (quieter)
   - Vocals: +8 dB (much louder)
   - Piano: -3 dB (slightly quieter)
4. Click "Mix Stems"
Result: Custom mix with emphasized vocals
```

---

## Common Questions

### Q: Why do sliders have different labels in different modes?

**A:** Each mode targets different audio content:
- **Music Mode:** Instruments (Drums, Bass, Vocals, Piano)
- **Animals Mode:** Animal sounds (Lion, Bird, Cat, Dog)
- **Human Mode:** Voice frequency ranges (Voice 1-4)

The labels help you understand what you're controlling.

---

### Q: What's the difference between EQ sliders and AI stem mixing?

**A:** Two different processing methods:

**EQ Sliders (FFT-based):**
- Works on frequency bands
- Fast but less precise
- Affects all sounds in that frequency range
- Example: Boosting 100 Hz boosts ALL sounds at 100 Hz

**AI Stem Mixing (Demucs):**
- Separates actual sources (drums, bass, vocals)
- Slow (30-60 seconds) but very precise
- Controls individual instruments
- Example: Muting vocals leaves drums/bass untouched even if they share frequencies

---

### Q: Why does moving a slider not change the audio immediately?

**A:** For performance! Computing IFFT (Inverse FFT) is expensive. If we processed on every slider movement, the app would lag. Instead:
1. Slider movement updates UI instantly (smooth feel)
2. You adjust all sliders to your preference
3. Click "Apply Changes" once to process
4. Backend computes FFT → Gain → IFFT (takes ~1 second)

---

### Q: Can I move multiple sliders before applying?

**A:** Yes! That's the design:
1. Move Drums to -10 dB
2. Move Bass to +5 dB
3. Move Vocals to +8 dB
4. Click "Apply Changes" **once**
5. All changes are applied together

---

### Q: What happens if sliders overlap?

**A:** Depends on the mode:

**Customized Mode (dB):** Maximum gain wins
- Slider 1: +10 dB at 200 Hz
- Slider 2: +5 dB at 200 Hz
- Result: +10 dB at 200 Hz (higher value wins)

**Generic Mode (linear):** Gains multiply
- Slider 1: 1.5× at 200 Hz
- Slider 2: 0.8× at 200 Hz
- Result: 1.5 × 0.8 = 1.2× at 200 Hz (cascade effect)

---

### Q: What's the "effective range" in the code?

**A:** It's the region where the slider has an effect. The algorithm adjusts it based on gain:

```python
if linear_gain < 0.1:              # Heavy cut
    effective_range = half_width * 5.0  # Wider effect
elif linear_gain < 0.3 or linear_gain > 1.7:  # Moderate change
    effective_range = half_width * 3.0
else:                              # Subtle change
    effective_range = half_width    # Narrow effect
```

**Why?** Extreme changes (like -40 dB mute) need wider transition zones to sound natural.

---

### Q: What does "normalized to prevent clipping" mean?

**A:** After applying gains, the audio might exceed the maximum allowed amplitude (±1.0). "Clipping" creates distortion. Normalization scales everything down:

```python
# Find maximum amplitude
max_val = np.max(np.abs(mixed_signal))

# Scale to 95% of maximum (leave headroom)
if max_val > 0:
    mixed_signal = mixed_signal / max_val * 0.95
```

This ensures the audio stays clean and undistorted.

---

## Technical Details

### Frequency Bin Calculation

Each slider affects specific frequency bins in the FFT array:

```python
# Example: 44100 Hz sample rate, 65536 FFT size
freq_resolution = 44100 / 65536 ≈ 0.67 Hz per bin

# Bin 100 represents: 100 * 0.67 ≈ 67 Hz
# Bin 1000 represents: 1000 * 0.67 ≈ 673 Hz
```

When a slider targets 145 Hz:
```python
target_bin = 145 / 0.67 ≈ 216
```

The algorithm applies the bell curve gain to bins around bin 216.

---

### Why Bell Curves?

Sharp rectangular gain changes cause **audio artifacts** (pops, clicks). Bell curves create smooth transitions:

```
Rectangular (BAD):          Bell Curve (GOOD):
    ┌───┐                        ╱‾‾╲
────┘   └────              ────╱    ╲────
    ↑   ↑                      ↑      ↑
  Harsh edges              Smooth transitions
```

---

## Summary

**The slider system is designed with these principles:**

1. **User-Friendly:** Sliders use familiar dB scale, color-coded feedback
2. **Flexible:** Works for both frequency bands (EQ) and AI stems (mixing)
3. **Efficient:** Process only when user clicks "Apply Changes"
4. **Smart:** Auto-detects whether you're using linear or dB values
5. **Smooth:** Bell curves prevent audio artifacts
6. **Visual:** Immediate UI feedback, detailed backend logging

**Key Takeaway:** Sliders are just **controllers** - they set parameters. The actual magic happens in `create_gain_array_from_sliders()` which converts your slider positions into a gain array that modifies the FFT, producing the equalized output.
