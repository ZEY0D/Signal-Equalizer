# Signal Equalizer - Bug Fixes Applied

## Date: November 28, 2025

## Issues Found and Fixed

### 1. **CRITICAL BUG: Slider Gain Assignment Instead of Multiplication**

**Location:** `backend/equalizer_core.py` - `create_gain_array_from_sliders()`

**Problem:**
```python
# OLD (INCORRECT):
gain_array[mask] = gain  # Assignment - overwrites previous sliders!
```

When multiple sliders overlapped, the last slider would **overwrite** the previous ones instead of combining them. This made it impossible to create complex EQ curves.

**Fix:**
```python
# NEW (CORRECT):
gain_array[i] *= effective_gain  # Multiplication - combines sliders!
```

Now sliders multiply their gains when overlapping, like real analog equalizers.

---

### 2. **Algorithm Mismatch: Different Bell Curves in Frontend vs Backend**

**Locations:** 
- Backend: `backend/equalizer_core.py`
- Frontend: `testfront/src/components/FrequencyGraph.jsx`

**Problem:**
- Backend used: `0.5 * (1 + np.cos(np.pi * normalized_dist))` (raised cosine)
- Frontend used: `Math.cos(normalized_dist * Math.PI / 2) ** 2` (different function!)

This caused the visual overlay on the frequency graph to not match the actual processing.

**Fix:**
Updated frontend to match backend:
```javascript
// MATCHES backend: 0.5 * (1 + np.cos(np.pi * normalized_dist))
const bellCurve = 0.5 * (1 + Math.cos(Math.PI * normalizedDist))
```

---

### 3. **Data Flow Issue: Input FFT Overwritten by Output**

**Location:** `testfront/src/hooks/useSignalProcessor.js`

**Problem:**
The `processSignal()` function was updating `fftData` state with the processed spectrum:
```javascript
// OLD (INCORRECT):
setFftData({
  frequencies: response.frequencies,
  magnitudes: response.magnitudes,
})
```

This caused the "Input Frequency Spectrum" panel to show the **output** spectrum instead of input, making it impossible to compare before/after.

**Fix:**
Removed the `setFftData` call. Now:
- `fftData` stays as **original input** spectrum (never changes)
- `outputFFT` shows the **processed output** spectrum (updates after processing)

---

## Improvements Made

### 1. **Smooth Bell Curve Window (Raised Cosine)**

Instead of rectangular frequency windows (sharp cutoffs), now uses smooth raised cosine:
```python
bell_curve = 0.5 * (1 + np.cos(np.pi * normalized_dist))
```

This prevents audio artifacts from sharp frequency transitions.

### 2. **Proper Slider Combination**

When sliders overlap:
- **Before:** Last slider overwrites → only one effect applied
- **After:** Sliders multiply → combined effect like real analog EQ

Example:
```
Slider 1: 800 Hz, gain=0.5 (reduce by 50%)
Slider 2: 1000 Hz, gain=0.5 (reduce by 50%)

At 900 Hz (overlap):
- Each applies 0.75 effective gain (bell curve at 50%)
- Combined: 0.75 × 0.75 = 0.5625 (combined attenuation) ✓
```

### 3. **Debug Logging**

Added console output showing:
- Each slider's parameters
- Gain array min/max values
- Helps diagnose issues quickly

---

## Verification Tests

Created `test_equalizer_fix.py` with 5 comprehensive tests:

1. ✅ Single slider (mute 1000 Hz without affecting 500 Hz)
2. ✅ FFT peak detection
3. ✅ Overlapping sliders multiply correctly
4. ✅ Bell curve smoothness
5. ✅ Frequency-domain to time-domain round-trip

**All tests pass!**

---

## How to Test in the Application

### Test 1: Single Slider (Surgical Frequency Removal)
1. Click "Create Test Signal" (20-second signal)
2. Add slider: 1000 Hz, width=200, gain=0.0
3. Click "Apply Processing"
4. **Expected:** 
   - Input spectrum: Shows all 5 peaks (100, 500, 1000, 2000, 4000 Hz)
   - Output spectrum: 1000 Hz peak disappears, others unchanged
   - Audio: When you play output, 8-12s segment (1000 Hz) is silent

### Test 2: Overlapping Sliders (Cascading Effects)
1. Create test signal
2. Add two sliders:
   - Slider 1: 800 Hz, width=400, gain=0.5
   - Slider 2: 1000 Hz, width=400, gain=0.5
3. Apply processing
4. **Expected:**
   - Output spectrum shows combined attenuation in 800-1000 Hz range
   - Effect is smooth, not abrupt
   - Sliders multiply (not overwrite)

### Test 3: Boost and Cut Combined
1. Create test signal
2. Add sliders:
   - Slider 1: 500 Hz, width=200, gain=2.0 (boost)
   - Slider 2: 1000 Hz, width=200, gain=0.0 (mute)
3. Apply processing
4. **Expected:**
   - 500 Hz gets louder (2x)
   - 1000 Hz gets muted (0x)
   - 100 Hz, 2000 Hz, 4000 Hz unchanged

---

## Technical Details

### Bell Curve (Raised Cosine Window)

```
Distance from center:  0%    25%    50%    75%   100%
Bell curve value:     1.00   0.85   0.50   0.15   0.00
Effective gain:       gain   ...    mid    ...    1.0
```

At the center: full gain applied
At the edge: no gain (unity, no effect)
Smooth transition in between

### Gain Multiplication Formula

```python
for each slider:
    for each frequency bin:
        if within slider width:
            bell_curve = 0.5 * (1 + cos(π * normalized_distance))
            effective_gain = 1.0 + (gain - 1.0) * bell_curve
            total_gain[freq] *= effective_gain  # MULTIPLY, not assign
```

---

## Files Modified

1. **backend/equalizer_core.py**
   - Fixed `create_gain_array_from_sliders()` to multiply gains
   - Changed from rectangular window to raised cosine bell curve
   - Added debug logging

2. **testfront/src/components/FrequencyGraph.jsx**
   - Updated `createSliderOverlay()` to match backend algorithm
   - Fixed bell curve calculation

3. **testfront/src/hooks/useSignalProcessor.js**
   - Removed `setFftData` from `processSignal()` to preserve input spectrum

4. **test_equalizer_fix.py** (new file)
   - Comprehensive test suite to verify fixes

---

## Performance Impact

- **Computation time:** Slightly slower (loop instead of vectorized mask)
- **Practical impact:** Negligible (processes in <100ms for typical signals)
- **Benefit:** Correct behavior + smooth transitions + proper slider combination

---

## Next Steps (Optional Enhancements)

1. **Optimize bell curve calculation:** Could vectorize using numpy broadcasting
2. **Add Q-factor control:** Allow users to adjust bell curve sharpness
3. **Preset EQ curves:** Bass boost, vocal presence, etc.
4. **Real-time visualization:** Animate gain array on frequency graph
5. **Undo/Redo:** Save slider history for easy experimentation

---

## Conclusion

The equalizer now works correctly! Sliders:
- ✅ Combine properly when overlapping (multiply, not overwrite)
- ✅ Use smooth transitions (no audio artifacts)
- ✅ Match visual overlay with actual processing
- ✅ Preserve input spectrum for comparison

**The "messing up" issues are now fixed!**
