"""
Quick test to verify the equalizer slider fixes work correctly.
Tests:
1. Single slider application
2. Overlapping sliders (should multiply, not overwrite)
3. Bell curve smoothness
"""

import numpy as np
import sys
sys.path.insert(0, '.')

from backend.equalizer_core import SignalProcessor, create_synthetic_test_signal

print("=" * 70)
print("EQUALIZER FIX VERIFICATION TEST")
print("=" * 70)

# Create synthetic signal with known frequencies
print("\n[Test 1] Creating synthetic signal...")
signal, sr = create_synthetic_test_signal([100, 500, 1000, 2000], duration=2.0)

# Initialize processor
processor = SignalProcessor()
processor.set_signal(signal, sr)

# Compute FFT
print("\n[Test 2] Computing FFT...")
freqs, mags, phases = processor.compute_fft()

# Find peaks
threshold = np.max(mags) * 0.5
peak_indices = np.where(mags > threshold)[0]
print("\nDetected frequency peaks:")
for idx in peak_indices:
    if freqs[idx] > 0:
        print(f"  {freqs[idx]:.1f} Hz (magnitude: {mags[idx]:.1f})")

# Test single slider
print("\n[Test 3] Applying single slider (mute 1000 Hz)...")
sliders = [
    {'center_freq': 1000, 'width': 200, 'gain': 0.0}
]
gain_array = processor.create_gain_array_from_sliders(sliders)
processor.apply_frequency_gain(gain_array)
output = processor.reconstruct_signal()

# Check if 1000 Hz is muted
_, output_mags, _ = processor.compute_fft()
freq_1000_idx = np.argmin(np.abs(freqs - 1000))
reduction_1000 = output_mags[freq_1000_idx] / mags[freq_1000_idx]

# Check if 500 Hz is unchanged
freq_500_idx = np.argmin(np.abs(freqs - 500))
reduction_500 = output_mags[freq_500_idx] / mags[freq_500_idx]

print(f"  1000 Hz reduction: {reduction_1000:.4f} (should be ~0.0)")
print(f"  500 Hz reduction: {reduction_500:.4f} (should be ~1.0)")

if reduction_1000 < 0.1 and reduction_500 > 0.8:
    print("  ✅ PASS: Single slider works correctly!")
else:
    print("  ❌ FAIL: Single slider not working as expected")

# Reset
processor.reset()
processor.compute_fft()

# Test overlapping sliders
print("\n[Test 4] Testing overlapping sliders...")
print("  Slider 1: 800 Hz, width=400, gain=0.5 (attenuate by 50%)")
print("  Slider 2: 1000 Hz, width=400, gain=0.5 (attenuate by 50%)")
print("  Both sliders affect 800-1000 Hz range")
print("  Expected at 900 Hz (strong overlap): ~0.25-0.35 (multiply, not 0.5)")

sliders = [
    {'center_freq': 800, 'width': 400, 'gain': 0.5},
    {'center_freq': 1000, 'width': 400, 'gain': 0.5}
]
gain_array = processor.create_gain_array_from_sliders(sliders)

# Check gain at 900 Hz (middle of overlap region)
freq_900_idx = np.argmin(np.abs(freqs - 900))
gain_at_900 = gain_array[freq_900_idx]

print(f"  Gain at 900 Hz: {gain_at_900:.4f}")

# Also check at 800 and 1000 Hz
freq_800_idx = np.argmin(np.abs(freqs - 800))
freq_1000_idx = np.argmin(np.abs(freqs - 1000))
print(f"  Gain at 800 Hz (center of slider 1): {gain_array[freq_800_idx]:.4f}")
print(f"  Gain at 1000 Hz (center of slider 2): {gain_array[freq_1000_idx]:.4f}")

# At 900 Hz, each slider has bell_curve = 0.5, so effective_gain = 0.75
# Combined: 0.75 * 0.75 = 0.5625
expected_combined = 0.5625
if abs(gain_at_900 - expected_combined) < 0.01:
    print(f"  ✅ PASS: Overlapping sliders multiply correctly! (0.75 × 0.75 = {gain_at_900:.4f})")
else:
    print(f"  ❌ FAIL: Expected {expected_combined:.4f}, got {gain_at_900:.4f}")

# Test bell curve smoothness
print("\n[Test 5] Testing bell curve smoothness...")
slider = {'center_freq': 1000, 'width': 500, 'gain': 2.0}
gain_array = processor.create_gain_array_from_sliders([slider])

# Sample gains at different distances from center
test_freqs = [1000, 1050, 1100, 1150, 1200, 1250]
print("  Frequency -> Gain (should decrease smoothly from center):")
for f in test_freqs:
    idx = np.argmin(np.abs(freqs - f))
    print(f"    {f} Hz: {gain_array[idx]:.3f}")

# Check that gains decrease smoothly
gains_at_test = [gain_array[np.argmin(np.abs(freqs - f))] for f in test_freqs]
is_monotonic = all(gains_at_test[i] >= gains_at_test[i+1] for i in range(len(gains_at_test)-1))

if is_monotonic and gains_at_test[0] > 1.9 and gains_at_test[-1] < 1.2:
    print("  ✅ PASS: Bell curve is smooth and correct!")
else:
    print("  ❌ FAIL: Bell curve not smooth")

print("\n" + "=" * 70)
print("TEST COMPLETE")
print("=" * 70)
