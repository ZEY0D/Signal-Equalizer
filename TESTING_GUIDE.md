# Signal Equalizer - Testing & Validation Guide

## 🎯 Quick Start Testing

### 1. Start the Application
```powershell
# Terminal 1 - Backend
cd D:\tamer\Signal-Equalizer-edited
python main.py

# Terminal 2 - Frontend
cd D:\tamer\Signal-Equalizer-edited\testfront
npm run dev
```

### 2. Create Test Signal
1. Click **"Create Test Signal"** button
2. You'll get a **20-second synthetic signal** with time-segmented frequencies
3. An alert will show the time layout

---

## 📊 20-Second Test Signal Layout

The synthetic signal is divided into **5 segments** of **4 seconds each**:

| Time Range | Frequency | What You'll Hear |
|------------|-----------|------------------|
| **0-4s**   | 100 Hz    | Low rumble (barely audible) |
| **4-8s**   | 500 Hz    | Deep bass tone |
| **8-12s**  | 1000 Hz   | **Mid-range tone (most prominent)** |
| **12-16s** | 2000 Hz   | High mid tone |
| **16-20s** | 4000 Hz   | High frequency tone |

**Each segment is a PURE tone** - no mixing! This allows surgical testing of your equalizer.

---

## 🎮 How to Use the Controls

### Audio Playback
- **Play Input**: Hear the original signal (green waveform)
- **Play Output**: Hear the processed signal (red waveform)
- **Pause**: Pauses both players
- **Stop All**: Stops playback completely
- **Speed Slider**: Controls playback speed for BOTH signals (0.5x - 2x)

### View Controls
- **Zoom In**: Zooms both viewers simultaneously
- **Zoom Out**: Unzooms both viewers
- **Reset View**: Returns both to default zoom
- **Pan**: Drag on any viewer, both will pan together

### Slider Controls
- **Add Slider**: Creates a new frequency slider
- **Center Frequency**: Position of the filter (0-22050 Hz)
- **Width**: Bandwidth of the filter (10-5000 Hz)
- **Gain**: Amplification factor (0 = mute, 1 = no change, 2 = double)

---

## 🧪 Scientific Validation Test (Professor's Requirement)

### Goal
Prove that you can **surgically remove** only the 1000 Hz tone without affecting 500 Hz or 2000 Hz.

### Steps
1. **Create test signal** (20 seconds)
2. **Add a slider**:
   - Center Frequency: `1000 Hz`
   - Width: `200 Hz` (narrow for precision)
   - Gain: `0` (mute)
3. **Click "Apply Processing"** (or wait for auto-process)

### What to Observe

#### ✅ On the Frequency Graph:
- **BEFORE**: You see 5 distinct spikes at 100, 500, 1000, 2000, 4000 Hz
- **AFTER**: The 1000 Hz spike **disappears** or becomes very small
- **500 Hz and 2000 Hz remain unchanged** ← This proves surgical precision!

#### ✅ On the Output Waveform:
- During seconds 8-12, the amplitude should drop significantly (1000 Hz segment is muted)
- Other time segments should look similar to input

#### ✅ When You Listen:
- **Play Input**: You hear all 5 tones in sequence
- **Play Output**: 
  - 0-4s: Low rumble ✓
  - 4-8s: Bass tone ✓
  - 8-12s: **SILENCE or very quiet** ← 1000 Hz is gone!
  - 12-16s: High mid ✓
  - 16-20s: High tone ✓

**If you hear silence at 8-12s but clear tones before and after, YOUR EQUALIZER WORKS!** 🎉

---

## 🔍 Real-Time Observation Guide

### When You MUTE a Frequency (gain = 0)
| What to Watch | Expected Result |
|---------------|-----------------|
| **Frequency Graph** | Spike at that frequency disappears/shrinks dramatically |
| **Output Waveform** | Amplitude decreases during that time segment |
| **Audio Playback** | You won't hear that specific tone (surgical removal!) |

### When You AMPLIFY a Frequency (gain = 2)
| What to Watch | Expected Result |
|---------------|-----------------|
| **Frequency Graph** | Spike at that frequency grows taller (2x height) |
| **Output Waveform** | Overall amplitude increases, more oscillations |
| **Audio Playback** | That tone becomes louder and more prominent |

### When You ADJUST Width
| Width Setting | Effect |
|---------------|--------|
| **Narrow (10-200 Hz)** | Surgical precision, affects only the target frequency |
| **Wide (500-5000 Hz)** | Broader effect, affects neighboring frequencies too |

---

## 🎯 Additional Test Scenarios

### Test 1: Amplify Mid Tone
- Add slider at 1000 Hz, width 200 Hz, gain = 2
- **Listen**: The 8-12s segment should be noticeably LOUDER
- **Observe**: Frequency graph spike at 1000 Hz doubles in height

### Test 2: Mute Low Frequencies
- Add slider at 100 Hz, width 100 Hz, gain = 0
- **Listen**: The 0-4s segment should be silent
- **Observe**: First spike disappears from frequency graph

### Test 3: Boost All High Frequencies
- Add slider at 3000 Hz, width 3000 Hz, gain = 1.5
- **Listen**: The last 8 seconds (2000 Hz and 4000 Hz) should be louder
- **Observe**: Right side of frequency graph gets taller

### Test 4: Create a "Notch Filter"
- Add slider at 500 Hz, width 100 Hz, gain = 0
- Add slider at 2000 Hz, width 100 Hz, gain = 0
- **Listen**: Only 100 Hz, 1000 Hz, and 4000 Hz remain
- **Observe**: Gaps in the frequency graph

---

## 🐛 Troubleshooting

### Zoom buttons not working?
- Make sure both viewers are displaying data
- Check browser console for errors
- Try Reset View first

### Viewers not synchronized?
- Both should zoom/pan together automatically
- If one seems stuck, click Reset View

### Audio playback issues?
- Make sure to click "Apply Processing" after adding sliders
- Output signal only exists after processing
- Check that your browser allows audio playback

### Backend not responding?
- Check that `python main.py` is running on port 8000
- Look for the green "Connected" indicator in the header
- Check backend terminal for error messages

---

## 📈 Performance Notes

### FFT Performance
- The backend uses **Cooley-Tukey FFT** with O(N log N) complexity
- 20-second signal = ~880,000 samples at 44.1 kHz
- FFT computation should take < 1 second
- Processing with sliders is very fast (just multiplication in frequency domain)

### Frontend Optimization
- Charts downsample to max 10,000 points for smooth rendering
- Frequency graph downsamples to max 1,000 points
- Auto-processing has 500ms debounce to avoid excessive backend calls

---

## 💡 Tips for Best Results

1. **Start Simple**: Create test signal, add ONE slider, observe results
2. **Use Narrow Width**: For testing, use width 100-300 Hz for precision
3. **Listen to Each Segment**: Pay attention to each 4-second period
4. **Compare Input vs Output**: Use the separate play buttons
5. **Watch the Frequency Graph**: This is your best validation tool
6. **Save Configurations**: Use the save/load feature to preserve good settings

---

## 🎓 Understanding the Math

### Why Time Segments?
When frequencies are **combined** (sine wave addition), it's hard to tell which slider affects which tone.
When frequencies are **separated in time**, you can hear exactly which segment is affected.

### The "Surgical Removal" Test
- **Input**: 5 pure tones playing in sequence
- **Process**: Apply gain = 0 at 1000 Hz only
- **Output**: If done correctly, ONLY the 1000 Hz segment disappears
- **Proof**: FFT + Inverse FFT with frequency-domain filtering works!

### What the Frequency Graph Shows
- **X-axis**: Frequency (Hz)
- **Y-axis**: Magnitude (amplitude of that frequency component)
- **Peaks**: Strong presence of that frequency in the signal
- **Valleys**: Weak/absent frequency components

---

## ✅ Success Criteria

Your equalizer is working correctly if:
1. ✓ You can create the 20-second test signal
2. ✓ Frequency graph shows 5 distinct peaks
3. ✓ You can mute 1000 Hz without affecting 500 Hz or 2000 Hz
4. ✓ Both viewers zoom/pan together perfectly
5. ✓ Audio playback reflects the processing (muted frequencies are silent)
6. ✓ Speed control affects both input and output playback

---

**Good luck with your DSP project! 🎵**
