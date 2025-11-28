"""
FFT Implementation Module - Student 1
Custom Fourier Transform implementation for the signal equalizer project.

CRITICAL: This module implements FFT/IFFT from scratch without using numpy.fft
or scipy.fft functions. This is a project requirement!

The implementation uses the Cooley-Tukey algorithm for efficient O(N log N) computation.
"""

import numpy as np


def next_power_of_2(n):
    """
    Calculate the next power of 2 greater than or equal to n.
    
    FFT is most efficient when the input size is a power of 2.
    
    Args:
        n (int): Input size
    
    Returns:
        int: Next power of 2 >= n
    
    Example:
        >>> next_power_of_2(100)
        128
        >>> next_power_of_2(512)
        512
    """
    if n <= 0:
        return 1
    
    # Use bit manipulation for efficiency
    power = 1
    while power < n:
        power *= 2
    
    return power


# def dft_slow(x):
#     """
#     Discrete Fourier Transform - Naive O(N²) implementation.
    
#     This is the textbook implementation for educational purposes.
#     DO NOT use this for large signals - it's extremely slow!
    
#     DFT Formula: X[k] = Σ(x[n] * e^(-j*2π*k*n/N)) for n=0 to N-1
    
#     Args:
#         x (np.ndarray): Time-domain signal (real or complex)
    
#     Returns:
#         np.ndarray: Frequency-domain signal (complex)
    
#     Example:
#         >>> signal = np.array([1, 2, 3, 4])
#         >>> freq = dft_slow(signal)
#     """
#     x = np.asarray(x, dtype=complex)
#     N = len(x)
    
#     # Initialize output array
#     X = np.zeros(N, dtype=complex)
    
#     # Compute DFT for each frequency bin k
#     for k in range(N):
#         for n in range(N):
#             # Core DFT formula: multiply by complex exponential
#             X[k] += x[n] * np.exp(-2j * np.pi * k * n / N)
    
#     return X


def fft_cooley_tukey(x):
    """
    Fast Fourier Transform - Cooley-Tukey Radix-2 Algorithm.
    
    This is a recursive implementation with O(N log N) complexity.
    
    Algorithm:
    1. Base case: If N=1, return x (DFT of single point is itself)
    2. Divide: Split x into even-indexed and odd-indexed elements
    3. Conquer: Recursively compute FFT of both halves
    4. Combine: Use butterfly operations to merge results
    
    Args:
        x (np.ndarray): Time-domain signal (length must be power of 2)
    
    Returns:
        np.ndarray: Frequency-domain signal (complex)
    
    Raises:
        ValueError: If input length is not a power of 2
    
    Example:
        >>> signal = np.array([1, 2, 3, 4])
        >>> freq = fft_cooley_tukey(signal)
    """
    x = np.asarray(x, dtype=complex)
    N = len(x)
    
    # Base case: single element
    if N <= 1:
        return x
    
    # Check if N is power of 2
    if N & (N - 1) != 0:
        raise ValueError(f"Input length must be power of 2, got {N}")
    
    # Divide: split into even and odd indices
    # here we apply the fft on the evens and the ods separetly
    even = fft_cooley_tukey(x[0::2])  # x[0], x[2], x[4], ...
    odd = fft_cooley_tukey(x[1::2])   # x[1], x[3], x[5], ...
    
    # Conquer: compute twiddle factors
    # Twiddle factor: W_N^k = e^(-2πi*k/N)
    k = np.arange(N // 2)
    W = np.exp(-2j * np.pi * k / N)
    
    # Combine: butterfly operation
    # X[k] = Even[k] + W[k] * Odd[k]
    # X[k + N/2] = Even[k] - W[k] * Odd[k]
    return np.concatenate([
        even + W * odd,
        even - W * odd
    ])


def fft(x, pad=True):
    """
    Fast Fourier Transform with automatic zero-padding.
    
    This is the main FFT function that other students should use.
    
    Args:
        x (np.ndarray): Time-domain signal (any length)
        pad (bool): If True, automatically pad to next power of 2
    
    Returns:
        np.ndarray: Frequency-domain signal (complex)
    
    Example:
        >>> signal = np.sin(2 * np.pi * 5 * np.linspace(0, 1, 100))
        >>> freq = fft(signal)  # Automatically pads to 128
    """
    x = np.asarray(x, dtype=complex)
    N = len(x)
    
    if pad:
        # Pad to next power of 2 for efficiency
        N_padded = next_power_of_2(N)
        
        if N_padded != N:
            # Zero-pad the signal
            x_padded = np.zeros(N_padded, dtype=complex)
            x_padded[:N] = x
            x = x_padded
    else:
        # Ensure length is power of 2
        if N & (N - 1) != 0:
            raise ValueError(f"Input length must be power of 2 when pad=False, got {N}")
    
    # Compute FFT
    return fft_cooley_tukey(x)


def ifft(X, pad=True):
    """
    Inverse Fast Fourier Transform.
    
    Converts frequency-domain signal back to time-domain.
    
    Mathematical trick: IFFT(X) = conj(FFT(conj(X))) / N
    
    This works because:
    - FFT uses e^(-2πi*k*n/N)
    - IFFT uses e^(+2πi*k*n/N)
    - Taking conjugate flips the sign of the exponent
    
    Args:
        X (np.ndarray): Frequency-domain signal (complex)
        pad (bool): If True, automatically pad to next power of 2. Default True.
    
    Returns:
        np.ndarray: Time-domain signal (complex, but imaginary part ≈ 0 for real inputs)
    
    Example:
        >>> freq = fft(signal)
        >>> reconstructed = ifft(freq)
        >>> np.allclose(signal, reconstructed.real)  # True
    """
    X = np.asarray(X, dtype=complex)
    original_len = len(X)
    
    # Apply same padding logic as fft for consistency
    if pad:
        target_len = next_power_of_2(original_len)
        if target_len != original_len:
            X_padded = np.zeros(target_len, dtype=complex)
            X_padded[:original_len] = X
            X = X_padded
    else:
        # Check if length is power of 2
        if len(X) & (len(X) - 1) != 0:
            raise ValueError(f"Input length must be power of 2 when pad=False, got {len(X)}")
    
    N = len(X)
    
    # Step 1: Take complex conjugate
    X_conj = np.conj(X)
    
    # Step 2: Apply FFT (now guaranteed to be power of 2)
    x_conj = fft_cooley_tukey(X_conj)
    
    # Step 3: Take conjugate again and normalize
    x = np.conj(x_conj) / N
    
    return x


def rfft(x, pad=True):
    """
    Real FFT - Optimized FFT for real-valued signals.
    
    For real signals, the FFT output is symmetric (X[k] = conj(X[N-k])).
    This function only returns the first N//2 + 1 elements (positive frequencies).
    
    Args:
        x (np.ndarray): Real-valued time-domain signal
        pad (bool): If True, automatically pad to next power of 2. Default True.
    
    Returns:
        np.ndarray: Frequency-domain (only positive frequencies)
    
    Note:
        If pad=True, the returned length will be based on the padded signal length.
        Use rfftfreq(len(padded_signal), 1/sr) to get correct frequencies.
    
    Example:
        >>> signal = np.sin(2 * np.pi * 5 * np.linspace(0, 1, 100))
        >>> freq = rfft(signal)  # Returns only half the spectrum
    """
    # Compute full FFT with specified padding
    X_full = fft(x, pad=pad)
    
    # Return only positive frequencies (plus DC and Nyquist)
    N = len(X_full)
    return X_full[:N // 2 + 1]


def irfft(X, n=None):
    """
    Inverse Real FFT.
    
    Reconstructs a real signal from its positive-frequency components.
    
    Args:
        X (np.ndarray): Positive frequency components (length n//2 + 1)
        n (int, optional): Desired output length. If None, inferred from len(X).
                          For even n: X has n//2 + 1 elements
                          For odd n:  X has (n+1)//2 elements
    
    Returns:
        np.ndarray: Real-valued time-domain signal of length n
    
    Note:
        If n is not provided, we assume even length: n = 2 * (len(X) - 1)
        This may not be correct for odd-length original signals!
    """
    X = np.asarray(X, dtype=complex)
    
    if n is None:
        # Assume even length (most common case for spectrograms)
        # For even n: len(X) = n//2 + 1, so n = 2 * (len(X) - 1)
        n = 2 * (len(X) - 1)
    
    # Validate input length
    expected_len = n // 2 + 1
    if len(X) != expected_len:
        raise ValueError(
            f"For n={n}, expected {expected_len} frequency components, got {len(X)}"
        )
    
    # Reconstruct full spectrum (create negative frequencies)
    X_full = np.zeros(n, dtype=complex)
    
    # Copy positive frequencies
    X_full[:len(X)] = X
    
    # Mirror for negative frequencies
    # For even n: mirror X[1] to X[n//2-1] to positions X[n//2+1] to X[n-1]
    # For odd n:  mirror X[1] to X[(n-1)//2] to positions X[(n+1)//2] to X[n-1]
    if n % 2 == 0:
        # Even: X_full[n//2+1:] = conj(X[n//2-1:0:-1])
        X_full[len(X):] = np.conj(X[-2:0:-1])
    else:
        # Odd: X_full[(n+1)//2:] = conj(X[(n-1)//2:0:-1])
        X_full[len(X):] = np.conj(X[-1:0:-1])
    
    # Apply IFFT with padding disabled (we already have correct length)
    x = ifft(X_full, pad=False)
    
    # Return real part (imaginary should be ~0 for properly symmetric input)
    return np.real(x)


def fft_magnitude(X):
    """
    Compute magnitude spectrum from FFT output.
    
    Args:
        X (np.ndarray): Frequency-domain signal (complex)
    
    Returns:
        np.ndarray: Magnitude spectrum (real, non-negative)
    
    Example:
        >>> freq = fft(signal)
        >>> magnitude = fft_magnitude(freq)
    """
    return np.abs(X)


def fft_phase(X):
    """
    Compute phase spectrum from FFT output.
    
    Args:
        X (np.ndarray): Frequency-domain signal (complex)
    
    Returns:
        np.ndarray: Phase spectrum in radians
    
    Example:
        >>> freq = fft(signal)
        >>> phase = fft_phase(freq)
    """
    return np.angle(X)


def fft_power(X):
    """
    Compute power spectrum from FFT output.
    
    Power = |X|² = magnitude squared
    
    Args:
        X (np.ndarray): Frequency-domain signal (complex)
    
    Returns:
        np.ndarray: Power spectrum
    """
    return np.abs(X) ** 2


def frequency_bins(n, sample_rate):
    """
    Generate frequency bins for FFT output (CUSTOM IMPLEMENTATION - NO NUMPY.FFT).
    
    Returns frequencies in the EXACT order of FFT output bins:
    [0, +df, +2df, ..., +Nyquist or +(n-1)df, -Nyquist or -(n-1)df, ..., -2df, -df]
    
    This matches np.fft.fftfreq behavior exactly.
    
    Args:
        n (int): Number of samples (FFT length)
        sample_rate (int): Sampling rate in Hz
    
    Returns:
        np.ndarray: Frequency values in Hz for each bin in FFT output order
    
    Example:
        >>> freqs = frequency_bins(8, 16)
        >>> print(freqs)  # [0, 2, 4, 6, -8, -6, -4, -2] Hz (matches FFT bin order)
    """
    if n <= 0:
        return np.array([])
        
    # Calculate the frequency resolution (distance between bins)
    freq_resolution = sample_rate / n
    
    # Pre-allocate result array for efficiency
    results = np.empty(n)
    
    if n % 2 == 0:  # Even length
        # First half: [0, 1, 2, ..., n/2-1] * freq_resolution
        results[:n//2] = np.arange(0, n//2) * freq_resolution
        # Second half: [-n/2, -n/2+1, ..., -1] * freq_resolution
        results[n//2:] = np.arange(-n//2, 0) * freq_resolution
    else:  # Odd length
        # First half: [0, 1, 2, ..., (n-1)/2] * freq_resolution
        results[:(n+1)//2] = np.arange(0, (n+1)//2) * freq_resolution
        # Second half: [-(n-1)/2, -(n-1)/2+1, ..., -1] * freq_resolution
        results[(n+1)//2:] = np.arange(-(n-1)//2, 0) * freq_resolution

    return results

def rfftfreq(n, d=1.0):
    """
    Return frequency bins for real FFT (CUSTOM IMPLEMENTATION - NO NUMPY.FFT).
    
    For real signals, we only need positive frequencies since the spectrum is symmetric.
    Returns frequencies from 0 to Nyquist frequency.
    
    This replaces np.fft.rfftfreq to comply with project requirements.
    
    Args:
        n (int): Window length (number of samples in time domain)
        d (float): Sample spacing (1/sample_rate). Default is 1.0.
    
    Returns:
        np.ndarray: Array of length n//2 + 1 containing positive frequencies only
    
    Example:
        >>> freqs = rfftfreq(8, 1/16)  # 8 samples at 16 Hz
        >>> print(freqs)  # [0, 2, 4, 6, 8] Hz
    """
    if n <= 0:
        return np.array([])
    
    # For rfft, we return only positive frequencies: [0, 1, 2, ..., n//2]
    # Number of positive frequency bins including DC and Nyquist
    num_positive = n // 2 + 1
    
    # Calculate frequency values
    freq_resolution = 1.0 / (n * d)
    
    return np.arange(num_positive) * freq_resolution


def fftshift(X):
    """
    Shift zero-frequency component to center of spectrum (CUSTOM IMPLEMENTATION).
    
    Splits the array at the halfway point and swaps the two halves.
    """
    X = np.asarray(X)
    N = len(X)
    
    # Calculate midpoint, handling both even and odd lengths
    mid = (N + 1) // 2
    
    # [X[mid:], X[:mid]]
    return np.concatenate((X[mid:], X[:mid]))


# ============================================================================
# Validation & Testing Functions
# ============================================================================

def validate_frequency_bins():
    """
    Validate our custom frequency_bins against numpy.fft.fftfreq.
    """
    print("=" * 60)
    print("Frequency Bins Validation Against numpy.fft.fftfreq")
    print("=" * 60)
    
    try:
        import numpy.fft
        
        # Test cases
        test_cases = [
            (8, 16),    # Even length, simple case
            (9, 18),    # Odd length
            (16, 44100), # Common audio case
            (512, 48000), # Typical FFT size
            (1024, 44100), # Common spectrogram window
        ]
        
        for n, sr in test_cases:
            print(f"\n[Test] n={n}, sample_rate={sr}")
            
            # Our implementation
            our_freqs = frequency_bins(n, sr)
            
            # NumPy's implementation (for validation only)
            numpy_freqs = numpy.fft.fftfreq(n, 1/sr)
            
            # Compare
            error = np.max(np.abs(our_freqs - numpy_freqs))
            print(f"  Our result:   {our_freqs[:5]}...{our_freqs[-3:]}")
            print(f"  NumPy result: {numpy_freqs[:5]}...{numpy_freqs[-3:]}")
            print(f"  Max error: {error:.2e}")
            
            if error < 1e-10:
                print("  ✅ PASSED")
            else:
                print(f"  ❌ FAILED - Error too large: {error}")
                return False
                
        print("\n✅ All frequency_bins tests PASSED!")
        return True
        
    except ImportError:
        print("⚠️ numpy.fft not available for validation")
        print("  Our implementation should work correctly")
        return True


def validate_rfftfreq():
    """
    Validate our custom rfftfreq against numpy.fft.rfftfreq.
    """
    print("=" * 60)
    print("rfftfreq Validation Against numpy.fft.rfftfreq")
    print("=" * 60)
    
    try:
        import numpy.fft
        
        # Test cases
        test_cases = [
            (8, 16),      # Even length
            (9, 18),      # Odd length
            (1024, 44100), # Common spectrogram window
            (512, 48000),  # Another typical size
        ]
        
        for n, sr in test_cases:
            print(f"\n[Test] n={n}, sample_rate={sr}")
            
            # Our implementation
            our_freqs = rfftfreq(n, 1/sr)
            
            # NumPy's implementation (for validation only)
            numpy_freqs = numpy.fft.rfftfreq(n, 1/sr)
            
            # Compare
            error = np.max(np.abs(our_freqs - numpy_freqs))
            print(f"  Our result:   {our_freqs[:5]}...{our_freqs[-3:]}")
            print(f"  NumPy result: {numpy_freqs[:5]}...{numpy_freqs[-3:]}")
            print(f"  Lengths: our={len(our_freqs)}, numpy={len(numpy_freqs)}")
            print(f"  Max error: {error:.2e}")
            
            if error < 1e-10:
                print("  ✅ PASSED")
            else:
                print(f"  ❌ FAILED - Error too large: {error}")
                return False
                
        print("\n✅ All rfftfreq tests PASSED!")
        return True
        
    except ImportError:
        print("⚠️ numpy.fft not available for validation")
        print("  Our implementation should work correctly")
        return True


def validate_spectrogram_calculation():
    """
    Test spectrogram calculation with known frequency signals.
    """
    print("=" * 60)
    print("Spectrogram Calculation Test")
    print("=" * 60)
    
    sample_rate = 1000  # 1000 Hz
    duration = 2.0
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    
    # Create test signal with known frequencies
    signal = (np.sin(2 * np.pi * 50 * t) +   # 50 Hz
              np.sin(2 * np.pi * 100 * t) +  # 100 Hz
              np.sin(2 * np.pi * 300 * t))   # 300 Hz
    
    print(f"\n[Test] Signal: {len(signal)} samples at {sample_rate} Hz")
    print(f"  Known frequencies: 50 Hz, 100 Hz, 300 Hz")
    
    # Calculate spectrogram
    window_size = 256
    hop_size = 128
    num_windows = (len(signal) - window_size) // hop_size + 1
    
    spectrogram = []
    for i in range(num_windows):
        start = i * hop_size
        end = start + window_size
        if end > len(signal):
            break
        
        window = signal[start:end]
        # this is just a factor for smoothing
        # hann is a bell curve factor
        # This makes the edges of the slice fade to zero so the math doesn't get confused by sharp cuts.
        hann = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(window_size) / window_size)
        windowed = window * hann
        
        # Use our custom FFT WITHOUT padding
        # pad=False is critical here because window_size (256) is already a power of 2
        fft_result = fft(windowed, pad=False)
        # We only keep the first half (positive frequencies) throw away the negative frequencies
        magnitude = np.abs(fft_result[:window_size//2 + 1])
        # F. Add this slice to our collection
        spectrogram.append(magnitude)
    
    # Get frequency axis using our custom rfftfreq
    freqs = rfftfreq(window_size, 1/sample_rate)
    # resolution = samplerate (1 / time between samples) / window size
    
    print(f"  Spectrogram shape: {len(spectrogram)} windows x {len(freqs)} frequencies")
    print(f"  Frequency range: {freqs[0]:.1f} Hz to {freqs[-1]:.1f} Hz")
    
    # and now spectrogram[5, 10] tells you the loudness of the 5th frequency band at the 10th time window.















    #this is just for testing 

    # Analyze middle time slice
    mid_idx = len(spectrogram) // 2
    freq_response = np.array(spectrogram[mid_idx])
    
    # Find peaks
    peaks = []
    for i in range(2, len(freq_response)-2):
        if (freq_response[i] > freq_response[i-1] and 
            freq_response[i] > freq_response[i+1] and
            freq_response[i] > 0.1 * np.max(freq_response)):
            peaks.append((freqs[i], freq_response[i]))
    
    peaks.sort(key=lambda x: x[1], reverse=True)
    detected_freqs = [f for f, _ in peaks[:3]]
    
    print(f"  Detected peaks: {[f'{f:.1f} Hz' for f in detected_freqs]}")
    
    # Verify peaks are close to expected
    expected = [50, 100, 300]
    tolerance = 10  # Hz
    
    success = True
    for exp_freq in expected:
        closest = min(detected_freqs, key=lambda x: abs(x - exp_freq))
        error = abs(closest - exp_freq)
        if error < tolerance:
            print(f"  ✅ Found {exp_freq} Hz peak at {closest:.1f} Hz (error: {error:.1f} Hz)")
        else:
            print(f"  ❌ Failed to find {exp_freq} Hz peak (closest: {closest:.1f} Hz, error: {error:.1f} Hz)")
            success = False
    
    if success:
        print("\n✅ Spectrogram test PASSED!")
    else:
        print("\n❌ Spectrogram test FAILED!")
    
    return success


def validate_fft(tolerance=1e-10):
    """
    Validate custom FFT implementation against scipy.
    
    Args:
        tolerance (float): Maximum allowed error
    
    Returns:
        bool: True if validation passes
    
    Raises:
        AssertionError: If error exceeds tolerance
    """
    from scipy.fft import fft as scipy_fft
    
    print("=" * 60)
    print("FFT Validation Against scipy.fft")
    print("=" * 60)
    
    # Test 1: Simple sine wave
    print("\n[Test 1] Single sine wave (5 Hz)...")
    t = np.linspace(0, 1, 512, endpoint=False)
    signal = np.sin(2 * np.pi * 5 * t)
    
    our_fft = fft(signal, pad=False)
    scipy_result = scipy_fft(signal)
    
    
    error = np.max(np.abs(our_fft - scipy_result))
    print(f"  Max error: {error:.2e}")
    assert error < tolerance, f"Error {error} exceeds tolerance {tolerance}"
    print("  ✓ PASSED")
    
    # Test 2: Multiple frequencies
    print("\n[Test 2] Multiple frequencies (5, 10, 20 Hz)...")
    signal = (np.sin(2 * np.pi * 5 * t) + 
              np.sin(2 * np.pi * 10 * t) + 
              np.sin(2 * np.pi * 20 * t))
    
    our_fft = fft(signal, pad=False)
    scipy_result = scipy_fft(signal)
    
    error = np.max(np.abs(our_fft - scipy_result))
    print(f"  Max error: {error:.2e}")
    assert error < tolerance, f"Error {error} exceeds tolerance {tolerance}"
    print("  ✓ PASSED")
    
    # Test 3: Random signal
    print("\n[Test 3] Random noise...")
    np.random.seed(42)
    signal = np.random.randn(256)
    
    our_fft = fft(signal, pad=False)
    scipy_result = scipy_fft(signal)
    
    error = np.max(np.abs(our_fft - scipy_result))
    print(f"  Max error: {error:.2e}")
    assert error < tolerance, f"Error {error} exceeds tolerance {tolerance}"
    print("  ✓ PASSED")
    
    # Test 4: FFT + IFFT round-trip
    print("\n[Test 4] FFT + IFFT round-trip...")
    signal = np.sin(2 * np.pi * 7 * t) + np.cos(2 * np.pi * 13 * t)
    
    freq = fft(signal, pad=False)
    reconstructed = ifft(freq)
    
    reconstructed_trimmed = reconstructed.real[:len(signal)]
    error = np.max(np.abs(signal - reconstructed_trimmed))
    # error = np.max(np.abs(signal - reconstructed.real))
    print(f"  Max reconstruction error: {error:.2e}")
    assert error < tolerance, f"Error {error} exceeds tolerance {tolerance}"
    print("  ✓ PASSED")
    
    print("\n" + "=" * 60)
    print("✓✓✓ ALL FFT VALIDATIONS PASSED! ✓✓✓")
    print("=" * 60)
    
    return True


if __name__ == "__main__":
    """
    Self-test and validation when run directly.
    """
    print("=" * 60)
    print("FFT Implementation Module - Self Test")
    print("=" * 60)
    
    # Basic functionality test
    print("\n[Demo] Basic FFT usage...")
    
    # Create a test signal: 5 Hz sine wave
    sample_rate = 100  # Hz
    duration = 1.0  # seconds
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    signal = np.sin(2 * np.pi * 5 * t)
    
    print(f"  Signal: {len(signal)} samples at {sample_rate} Hz")
    
    # Compute FFT
    freq_domain = fft(signal)
    magnitude = fft_magnitude(freq_domain)
    
    print(f"  FFT output: {len(freq_domain)} complex values")
    
    # Find peak frequency
    freqs = frequency_bins(len(freq_domain), sample_rate)
    peak_idx = np.argmax(magnitude[:len(magnitude)//2])
    peak_freq = abs(freqs[peak_idx])
    
    print(f"  Peak frequency detected: {peak_freq:.1f} Hz (expected: 5.0 Hz)")
    
    # Test IFFT
    reconstructed = ifft(freq_domain)
    reconstructed_trimmed = reconstructed.real[:len(signal)]
    error = np.max(np.abs(signal - reconstructed_trimmed))
    # error = np.max(np.abs(signal - reconstructed.real))
    print(f"  IFFT reconstruction error: {error:.2e}")
    
    # Run full validation
    print("\n")
    try:
        # Validate frequency bins
        validate_frequency_bins()
        print("\n")
        
        # Validate rfftfreq
        validate_rfftfreq()
        print("\n")
        
        # Validate spectrogram calculation
        validate_spectrogram_calculation()
        print("\n")
        
        # Validate FFT/IFFT
        validate_fft()
    except ImportError as e:
        print(f"⚠ Missing dependency: {e}")
        print("  (Install scipy to run validation: pip install scipy)")