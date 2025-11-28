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


def dft_slow(x):
    """
    Discrete Fourier Transform - Naive O(N²) implementation.
    
    This is the textbook implementation for educational purposes.
    DO NOT use this for large signals - it's extremely slow!
    
    DFT Formula: X[k] = Σ(x[n] * e^(-j*2π*k*n/N)) for n=0 to N-1
    
    Args:
        x (np.ndarray): Time-domain signal (real or complex)
    
    Returns:
        np.ndarray: Frequency-domain signal (complex)
    
    Example:
        >>> signal = np.array([1, 2, 3, 4])
        >>> freq = dft_slow(signal)
    """
    x = np.asarray(x, dtype=complex)
    N = len(x)
    
    # Initialize output array
    X = np.zeros(N, dtype=complex)
    
    # Compute DFT for each frequency bin k
    for k in range(N):
        for n in range(N):
            # Core DFT formula: multiply by complex exponential
            X[k] += x[n] * np.exp(-2j * np.pi * k * n / N)
    
    return X


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


def ifft(X):
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
    
    Returns:
        np.ndarray: Time-domain signal (complex, but imaginary part ≈ 0 for real inputs)
    
    Example:
        >>> freq = fft(signal)
        >>> reconstructed = ifft(freq)
        >>> np.allclose(signal, reconstructed.real)  # True
    """
    X = np.asarray(X, dtype=complex)
    N = len(X)
    
    # Step 1: Take complex conjugate
    X_conj = np.conj(X)
    
    # Step 2: Apply FFT
    x_conj = fft_cooley_tukey(X_conj)
    
    # Step 3: Take conjugate again and normalize
    x = np.conj(x_conj) / N
    
    return x


def rfft(x):
    """
    Real FFT - Optimized FFT for real-valued signals.
    
    For real signals, the FFT output is symmetric (X[k] = conj(X[N-k])).
    This function only returns the first N//2 + 1 elements (positive frequencies).
    
    Args:
        x (np.ndarray): Real-valued time-domain signal
    
    Returns:
        np.ndarray: Frequency-domain (only positive frequencies)
    
    Example:
        >>> signal = np.sin(2 * np.pi * 5 * np.linspace(0, 1, 100))
        >>> freq = rfft(signal)  # Returns only half the spectrum
    """
    # Compute full FFT
    X_full = fft(x)
    
    # Return only positive frequencies (plus DC and Nyquist)
    N = len(X_full)
    return X_full[:N // 2 + 1]


def irfft(X, n=None):
    """
    Inverse Real FFT.
    
    Reconstructs a real signal from its positive-frequency components.
    
    Args:
        X (np.ndarray): Positive frequency components
        n (int, optional): Desired output length. If None, assumes even length.
    
    Returns:
        np.ndarray: Real-valued time-domain signal
    """
    if n is None:
        n = 2 * (len(X) - 1)
    
    # Reconstruct full spectrum (create negative frequencies)
    X_full = np.zeros(n, dtype=complex)
    X_full[:len(X)] = X
    
    # Mirror for negative frequencies (excluding DC and Nyquist)
    X_full[len(X):] = np.conj(X[1:len(X)-1][::-1])
    
    # Apply IFFT
    x = ifft(X_full)
    
    # Return real part (imaginary should be ~0)
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


# THIS IS THE CORRECTED CODE
def frequency_bins(n, sample_rate):
    """
    Generate frequency bins for FFT output (CUSTOM IMPLEMENTATION).
    
    Args:
        n (int): Number of samples (FFT length)
        sample_rate (int): Sampling rate in Hz
    
    Returns:
        np.ndarray: Frequency values in Hz for each bin
    """
    if n <= 0:
        return np.array([])
        
    # Calculate the frequency resolution (distance between bins)
    freq_resolution = sample_rate / n
    
    # Generate the first half of frequencies (positive)
    # n // 2 is integer division
    positive_freqs = np.arange(0, n // 2) * freq_resolution
    
    # Generate the second half of frequencies (negative)
    # These correspond to the "wrap-around" part of the FFT
    negative_freqs = np.arange(-n // 2, 0) * freq_resolution

    # Combine them
    # This ordering [0, +f, ..., -f, ...] is the standard FFT output format
    return np.concatenate((positive_freqs, negative_freqs))

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
        validate_fft()
    except ImportError:
        print("⚠ scipy not available, skipping validation")
        print("  (Install scipy to run validation: pip install scipy)")
