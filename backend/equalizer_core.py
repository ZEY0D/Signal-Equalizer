"""
Equalizer Core Module - Student 1 Main Deliverable
The complete DSP engine for the signal equalizer project.

This is the main API that other students (2, 3, 4) will use.
It combines signal I/O and FFT functionality into a clean interface.

Usage Example:
    from backend.equalizer_core import SignalProcessor
    
    # Load signal
    processor = SignalProcessor("audio.wav")
    
    # Get frequency data
    freqs, mags, phases = processor.compute_fft()
    
    # Apply gain (Student 4 will generate this array)
    gain_array = np.ones(len(freqs))
    gain_array[100:200] = 1.5  # Boost frequencies 100-200
    
    processor.apply_frequency_gain(gain_array)
    
    # Reconstruct signal
    output = processor.reconstruct_signal()
    
    # Save result
    processor.save_output("output.wav")
"""

import numpy as np
import os
from .signal_io import (
    load_signal, 
    save_signal, 
    convert_to_mono, 
    normalize_signal,
    get_audio_info
)
from .fft_implementation import (
    fft, 
    ifft, 
    fft_magnitude, 
    fft_phase,
    frequency_bins
)


class SignalProcessor:
    """
    Main signal processing class for the equalizer.
    
    This class handles the complete pipeline:
    1. Load audio file
    2. Compute FFT
    3. Apply frequency-domain modifications (gain)
    4. Reconstruct time-domain signal via IFFT
    5. Save output
    
    Attributes:
        filepath (str): Original audio file path
        sample_rate (int): Sampling rate in Hz
        original_data (np.ndarray): Original time-domain signal (preserved)
        data (np.ndarray): Current time-domain signal
        freq_domain (np.ndarray): Original frequency-domain (complex)
        modified_freq_domain (np.ndarray): Modified frequency-domain (complex)
        frequencies (np.ndarray): Frequency bin values in Hz
        original_length (int): Original signal length (for trimming after IFFT)
    """
    
    def __init__(self, filepath=None):
        """
        Initialize the signal processor.
        
        Args:
            filepath (str, optional): Path to audio file. If None, use set_signal().
        
        Example:
            >>> processor = SignalProcessor("audio.wav")
        """
        self.filepath = filepath
        self.sample_rate = None
        self.original_data = None
        self.data = None
        self.freq_domain = None
        self.modified_freq_domain = None
        self.frequencies = None
        self.original_length = None
        
        # Load signal if filepath provided
        if filepath is not None:
            self.load_from_file(filepath)
    
    def load_from_file(self, filepath):
        """
        Load an audio file and prepare for processing.
        
        Args:
            filepath (str): Path to audio file
        
        Raises:
            FileNotFoundError: If file doesn't exist
        """
        self.filepath = filepath
        
        # Load audio file
        data, sample_rate = load_signal(filepath)
        
        # Convert to mono if stereo
        if len(data.shape) > 1:
            print("  Converting stereo to mono...")
            data = convert_to_mono(data)
        
        # Store original data (never modified)
        self.original_data = data.copy()
        self.data = data
        self.sample_rate = sample_rate
        self.original_length = len(data)
        
        print(f"✓ Signal loaded and ready for processing")
        print(f"  - Length: {self.original_length} samples")
        print(f"  - Duration: {self.original_length / self.sample_rate:.2f} seconds")
        print(f"  - Sample Rate: {self.sample_rate} Hz")
    
    def set_signal(self, data, sample_rate):
        """
        Set signal data directly (without loading from file).
        
        Useful for synthetic signals or real-time processing.
        
        Args:
            data (np.ndarray): Time-domain signal
            sample_rate (int): Sampling rate in Hz
        
        Example:
            >>> processor = SignalProcessor()
            >>> processor.set_signal(my_signal, 44100)
        """
        self.data = np.array(data)
        self.original_data = self.data.copy()
        self.sample_rate = sample_rate
        self.original_length = len(data)
        self.filepath = None
        
        print(f"✓ Signal set directly")
        print(f"  - Length: {self.original_length} samples")
        print(f"  - Sample Rate: {self.sample_rate} Hz")
    
    def compute_fft(self):
        """
        Compute FFT of the loaded signal.
        
        Returns:
            tuple: (frequencies, magnitudes, phases)
                - frequencies (np.ndarray): Frequency values in Hz
                - magnitudes (np.ndarray): Magnitude spectrum
                - phases (np.ndarray): Phase spectrum in radians
        
        Example:
            >>> freqs, mags, phases = processor.compute_fft()
            >>> print(f"Frequency range: {freqs[0]:.1f} to {freqs[-1]:.1f} Hz")
        """
        if self.data is None:
            raise ValueError("No signal loaded. Use load_from_file() or set_signal() first.")
        
        print("Computing FFT...")
        
        # Compute FFT (with automatic zero-padding to power of 2)
        self.freq_domain = fft(self.data)
        
        # Calculate frequency bins
        N = len(self.freq_domain)
        self.frequencies = frequency_bins(N, self.sample_rate)
        
        # Calculate magnitude and phase
        magnitudes = fft_magnitude(self.freq_domain)
        phases = fft_phase(self.freq_domain)
        
        print(f"✓ FFT computed: {N} frequency bins")
        print(f"  - Frequency resolution: {self.sample_rate / N:.2f} Hz/bin")
        print(f"  - Max frequency (Nyquist): {self.sample_rate / 2} Hz")
        
        return self.frequencies, magnitudes, phases
    
    def apply_frequency_gain(self, gain_array):
        """
        Apply gain to frequency domain.
        
        This is the core equalization operation!
        
        Args:
            gain_array (np.ndarray): Array of gain values (same length as freq_domain)
                - Value of 1.0 = no change
                - Value > 1.0 = boost (amplify)
                - Value < 1.0 = attenuate (reduce)
                - Value of 0.0 = complete removal
        
        Returns:
            np.ndarray: Modified frequency domain (complex)
        
        Raises:
            ValueError: If gain_array length doesn't match frequency domain
        
        Example:
            >>> gain = np.ones(len(processor.freq_domain))
            >>> gain[100:200] = 1.5  # Boost frequencies at indices 100-200
            >>> gain[300:400] = 0.5  # Reduce frequencies at indices 300-400
            >>> processor.apply_frequency_gain(gain)
        """
        if self.freq_domain is None:
            # Compute FFT if not already done
            self.compute_fft()
        
        # Validate gain array length
        if len(gain_array) != len(self.freq_domain):
            raise ValueError(
                f"Gain array length ({len(gain_array)}) must match "
                f"frequency domain length ({len(self.freq_domain)})"
            )
        
        # Apply gain by element-wise multiplication
        # This preserves phase information (only magnitude is scaled)
        self.modified_freq_domain = self.freq_domain * gain_array
        
        print(f"✓ Frequency gain applied")
        
        return self.modified_freq_domain
    
    def reconstruct_signal(self):
        """
        Apply IFFT to reconstruct time-domain signal.
        
        Returns:
            np.ndarray: Reconstructed time-domain signal (real-valued)
        
        Raises:
            ValueError: If no modified frequency domain is available
        
        Example:
            >>> output_signal = processor.reconstruct_signal()
            >>> processor.save_output("output.wav", output_signal)
        """
        if self.modified_freq_domain is None:
            raise ValueError(
                "No modified frequency domain available. "
                "Call apply_frequency_gain() first."
            )
        
        print("Reconstructing signal via IFFT...")
        
        # Apply Inverse FFT
        reconstructed = ifft(self.modified_freq_domain)
        
        # Take real part (imaginary part should be ~0 for real input signals)
        reconstructed = np.real(reconstructed)
        
        # Trim to original length (remove zero-padding)
        reconstructed = reconstructed[:self.original_length]
        
        # Normalize to prevent clipping
        reconstructed = normalize_signal(reconstructed)
        
        # Update current data
        self.data = reconstructed
        
        print(f"✓ Signal reconstructed: {len(reconstructed)} samples")
        
        return reconstructed
    
    def save_output(self, output_path, data=None):
        """
        Save processed signal to file.
        
        Args:
            output_path (str): Where to save the output file
            data (np.ndarray, optional): Data to save. If None, uses current data.
        
        Example:
            >>> processor.save_output("output.wav")
        """
        if data is None:
            # Use current data
            if self.data is None:
                raise ValueError("No signal data available to save.")
            data = self.data
        
        # Save using signal_io module
        save_signal(output_path, data, self.sample_rate)
    
    def reset(self):
        """
        Reset to original signal (undo all modifications).
        
        Example:
            >>> processor.apply_frequency_gain(some_gain)
            >>> processor.reconstruct_signal()
            >>> processor.reset()  # Back to original
        """
        if self.original_data is None:
            raise ValueError("No original data available to reset to.")
        
        self.data = self.original_data.copy()
        self.freq_domain = None
        self.modified_freq_domain = None
        
        print("✓ Reset to original signal")
    
    def get_frequency_bins(self):
        """
        Get frequency bin information for slider positioning.
        
        Returns:
            np.ndarray: Frequency values in Hz for each bin
        
        Example:
            >>> freqs = processor.get_frequency_bins()
            >>> # Student 4 uses this to map slider positions to frequency bins
        """
        if self.frequencies is None:
            # Compute FFT if not already done
            self.compute_fft()
        
        return self.frequencies
    
    def get_frequency_range(self):
        """
        Get the frequency range of the signal.
        
        Returns:
            tuple: (min_freq, max_freq) in Hz
        
        Example:
            >>> min_f, max_f = processor.get_frequency_range()
            >>> print(f"Frequency range: {min_f} to {max_f} Hz")
        """
        if self.sample_rate is None:
            raise ValueError("No signal loaded.")
        
        # Minimum frequency is 0 Hz (DC component)
        # Maximum frequency is Nyquist frequency (sample_rate / 2)
        return 0, self.sample_rate / 2
    
    def get_info(self):
        """
        Get comprehensive information about the current signal.
        
        Returns:
            dict: Signal information
        
        Example:
            >>> info = processor.get_info()
            >>> print(info)
        """
        if self.data is None:
            return {"status": "No signal loaded"}
        
        return {
            "filepath": self.filepath,
            "sample_rate": self.sample_rate,
            "length_samples": len(self.data),
            "duration_seconds": len(self.data) / self.sample_rate,
            "original_length": self.original_length,
            "frequency_range_hz": (0, self.sample_rate / 2),
            "fft_computed": self.freq_domain is not None,
            "modified": self.modified_freq_domain is not None
        }
    
    def create_gain_array_from_sliders(self, slider_list):
        """
        Helper function to create gain array from slider parameters.
        
        This is what Student 4 will use to convert slider UI state into a gain array.
        
        Args:
            slider_list (list): List of dicts, each containing:
                - 'center_freq' (float): Center frequency in Hz
                - 'width' (float): Width of frequency range in Hz
                - 'gain' (float): Gain value (0 to 2)
        
        Returns:
            np.ndarray: Gain array ready for apply_frequency_gain()
        
        Example:
            >>> sliders = [
            ...     {'center_freq': 100, 'width': 50, 'gain': 1.5},
            ...     {'center_freq': 1000, 'width': 200, 'gain': 0.8}
            ... ]
            >>> gain = processor.create_gain_array_from_sliders(sliders)
            >>> processor.apply_frequency_gain(gain)
        """
        if self.frequencies is None:
            self.compute_fft()
        
        # Start with unity gain (no change)
        gain_array = np.ones(len(self.frequencies))
        
        # Apply each slider's gain to its frequency range
        for slider in slider_list:
            center = slider['center_freq']
            width = slider['width']
            gain = slider['gain']
            
            # Calculate frequency range
            freq_min = center - width / 2
            freq_max = center + width / 2
            
            # Find bins that fall within this range
            # Use absolute value to handle both positive and negative frequencies
            mask = (np.abs(self.frequencies) >= freq_min) & \
                   (np.abs(self.frequencies) <= freq_max)
            
            # Apply gain to these bins
            gain_array[mask] = gain
        
        return gain_array


# ============================================================================
# Utility Functions for Students 2, 3, 4
# ============================================================================

def create_synthetic_test_signal(frequencies_hz, duration=2.0, sample_rate=44100):
    """
    Create a synthetic test signal with multiple pure tones.
    
    This is useful for validation - you can verify that each slider
    only affects its intended frequency.
    
    Args:
        frequencies_hz (list): List of frequencies in Hz
        duration (float): Duration in seconds
        sample_rate (int): Sampling rate in Hz
    
    Returns:
        tuple: (signal, sample_rate)
    
    Example:
        >>> # Create test signal with 4 pure tones
        >>> signal, sr = create_synthetic_test_signal([100, 500, 1000, 2000])
        >>> processor = SignalProcessor()
        >>> processor.set_signal(signal, sr)
    """
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    signal = np.zeros_like(t)
    
    # Add each frequency component
    for freq in frequencies_hz:
        signal += np.sin(2 * np.pi * freq * t)
    
    # Normalize
    signal = normalize_signal(signal)
    
    print(f"✓ Created synthetic signal:")
    print(f"  - Frequencies: {frequencies_hz} Hz")
    print(f"  - Duration: {duration} s")
    print(f"  - Sample Rate: {sample_rate} Hz")
    
    return signal, sample_rate


# ============================================================================
# Main (Testing & Demo)
# ============================================================================

if __name__ == "__main__":
    """
    Self-test and demonstration.
    """
    print("=" * 70)
    print("EQUALIZER CORE MODULE - COMPLETE PIPELINE TEST")
    print("=" * 70)
    
    # Step 1: Create synthetic test signal
    print("\n[Step 1] Creating synthetic test signal...")
    test_freqs = [100, 500, 1000, 2000]  # Hz
    signal, sr = create_synthetic_test_signal(test_freqs, duration=2.0)
    
    # Step 2: Initialize processor
    print("\n[Step 2] Initializing signal processor...")
    processor = SignalProcessor()
    processor.set_signal(signal, sr)
    
    # Step 3: Compute FFT
    print("\n[Step 3] Computing FFT...")
    freqs, mags, phases = processor.compute_fft()
    
    # Find peaks in magnitude spectrum
    print("\n  Detected frequency peaks:")
    # Only look at positive frequencies
    positive_freqs = freqs[:len(freqs)//2]
    positive_mags = mags[:len(mags)//2]
    
    # Find peaks above a threshold
    threshold = np.max(positive_mags) * 0.5
    peak_indices = np.where(positive_mags > threshold)[0]
    
    for idx in peak_indices:
        if positive_freqs[idx] > 0:  # Skip DC
            print(f"    {positive_freqs[idx]:.1f} Hz (magnitude: {positive_mags[idx]:.1f})")
    
    # Step 4: Apply gain using slider simulation
    print("\n[Step 4] Applying frequency gains (simulating sliders)...")
    
    # Simulate 3 sliders:
    # - Boost 500 Hz by 1.5x
    # - Reduce 1000 Hz to 0.5x
    # - Keep others unchanged
    sliders = [
        {'center_freq': 500, 'width': 100, 'gain': 1.5},
        {'center_freq': 1000, 'width': 100, 'gain': 0.5}
    ]
    
    gain_array = processor.create_gain_array_from_sliders(sliders)
    processor.apply_frequency_gain(gain_array)
    
    print("  Applied gains:")
    for slider in sliders:
        print(f"    {slider['center_freq']} Hz: gain = {slider['gain']}")
    
    # Step 5: Reconstruct signal
    print("\n[Step 5] Reconstructing signal via IFFT...")
    output_signal = processor.reconstruct_signal()
    
    # Step 6: Save output
    print("\n[Step 6] Saving output...")
    output_path = "test_output_equalizer_core.wav"
    processor.save_output(output_path)
    
    # Step 7: Display info
    print("\n[Step 7] Signal information:")
    info = processor.get_info()
    for key, value in info.items():
        print(f"  {key}: {value}")
    
    # Cleanup
    if os.path.exists(output_path):
        print(f"\n✓ Test output saved: {output_path}")
        print("  (You can delete this file after testing)")
    
    print("\n" + "=" * 70)
    print("✓✓✓ COMPLETE PIPELINE TEST PASSED! ✓✓✓")
    print("=" * 70)
    print("\nStudent 1's DSP Engine is ready for integration!")
    print("Other students can now import and use SignalProcessor class.")
