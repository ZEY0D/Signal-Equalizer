"""
Signal I/O Module - Student 1
Handles loading and saving audio files for the signal equalizer project.

This module provides utilities for:
- Loading audio files (WAV, FLAC, etc.)
- Saving processed audio
- Converting stereo to mono
- Normalizing signal amplitudes
"""

import soundfile as sf
import numpy as np
import os


def load_signal(filepath):
    """
    Load an audio file and return time-domain data.
    
    Args:
        filepath (str): Path to audio file (.wav, .flac, .ogg, etc.)
    
    Returns:
        tuple: (data, sample_rate)
            - data (np.ndarray): Audio samples (1D for mono, 2D for stereo)
            - sample_rate (int): Sampling rate in Hz
    
    Raises:
        FileNotFoundError: If the file doesn't exist
        RuntimeError: If the file format is unsupported
    
    Example:
        >>> data, sr = load_signal("audio.wav")
        >>> print(f"Loaded {len(data)} samples at {sr} Hz")
    """
    # Check if file exists
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Audio file not found: {filepath}")
    
    try:
        # Load audio file using soundfile
        data, sample_rate = sf.read(filepath)
        
        print(f"✓ Loaded: {filepath}")
        print(f"  - Samples: {len(data)}")
        print(f"  - Sample Rate: {sample_rate} Hz")
        print(f"  - Duration: {len(data) / sample_rate:.2f} seconds")
        
        # Check if stereo or mono
        if len(data.shape) > 1:
            print(f"  - Channels: {data.shape[1]} (stereo)")
        else:
            print(f"  - Channels: 1 (mono)")
        
        return data, sample_rate
    
    except Exception as e:
        raise RuntimeError(f"Failed to load audio file: {str(e)}")


def save_signal(filepath, data, sample_rate):
    """
    Save audio data to a file.
    
    Args:
        filepath (str): Output path (e.g., "output.wav")
        data (np.ndarray): Audio samples (1D for mono, 2D for stereo)
        sample_rate (int): Sampling rate in Hz
    
    Raises:
        ValueError: If data or sample_rate is invalid
    
    Example:
        >>> save_signal("output.wav", processed_data, 44100)
    """
    # Validate inputs
    if not isinstance(data, np.ndarray):
        raise ValueError("Data must be a numpy array")
    
    if sample_rate <= 0:
        raise ValueError("Sample rate must be positive")
    
    # Ensure data is in valid range [-1, 1]
    if np.max(np.abs(data)) > 1.0:
        print("⚠ Warning: Signal amplitude > 1.0, normalizing to prevent clipping...")
        data = normalize_signal(data)
    
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else ".", exist_ok=True)
        
        # Save audio file
        sf.write(filepath, data, sample_rate)
        
        print(f"✓ Saved: {filepath}")
        print(f"  - Samples: {len(data)}")
        print(f"  - Sample Rate: {sample_rate} Hz")
        
    except Exception as e:
        raise RuntimeError(f"Failed to save audio file: {str(e)}")


def convert_to_mono(data):
    """
    Convert stereo (or multi-channel) audio to mono by averaging channels.
    
    Args:
        data (np.ndarray): Audio data
            - If 1D: already mono, returned as-is
            - If 2D: stereo/multi-channel, averaged to mono
    
    Returns:
        np.ndarray: 1D mono audio array
    
    Example:
        >>> stereo_data = np.array([[0.5, 0.3], [0.7, 0.2]])  # 2 samples, 2 channels
        >>> mono_data = convert_to_mono(stereo_data)
        >>> print(mono_data)  # [0.4, 0.45]
    """
    # If already mono (1D array), return as-is
    if len(data.shape) == 1:
        return data
    
    # If stereo/multi-channel (2D array), average across channels
    if len(data.shape) == 2:
        mono = np.mean(data, axis=1)
        print(f"✓ Converted {data.shape[1]} channels to mono")
        return mono
    
    # Unexpected shape
    raise ValueError(f"Unexpected audio data shape: {data.shape}")


def normalize_signal(data, target_level=0.95):
    """
    Normalize audio signal to a target peak level.
    
    This prevents clipping (values exceeding ±1.0) which causes distortion.
    
    Args:
        data (np.ndarray): Audio samples
        target_level (float): Target peak level (default: 0.95 to leave headroom)
    
    Returns:
        np.ndarray: Normalized audio (peak amplitude = target_level)
    
    Example:
        >>> loud_signal = np.array([2.0, -3.0, 1.5])
        >>> normalized = normalize_signal(loud_signal)
        >>> print(np.max(np.abs(normalized)))  # 0.95
    """
    # Find current peak amplitude
    peak = np.max(np.abs(data))
    
    # Avoid division by zero
    if peak == 0:
        return data
    
    # Scale to target level
    normalized = data * (target_level / peak)
    
    return normalized


def get_audio_info(filepath):
    """
    Get information about an audio file without loading the full data.
    
    Args:
        filepath (str): Path to audio file
    
    Returns:
        dict: Audio file information
            - 'sample_rate': Sampling rate in Hz
            - 'channels': Number of channels
            - 'frames': Number of audio frames
            - 'duration': Duration in seconds
            - 'format': File format
            - 'subtype': Audio encoding subtype
    
    Example:
        >>> info = get_audio_info("audio.wav")
        >>> print(f"Duration: {info['duration']:.2f} seconds")
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Audio file not found: {filepath}")
    
    try:
        info = sf.info(filepath)
        
        return {
            'sample_rate': info.samplerate,
            'channels': info.channels,
            'frames': info.frames,
            'duration': info.duration,
            'format': info.format,
            'subtype': info.subtype
        }
    
    except Exception as e:
        raise RuntimeError(f"Failed to read audio info: {str(e)}")


def trim_silence(data, sample_rate, threshold_db=-40, min_silence_duration=0.1):
    """
    Remove silence from the beginning and end of an audio signal.
    
    Args:
        data (np.ndarray): Audio samples
        sample_rate (int): Sampling rate in Hz
        threshold_db (float): Silence threshold in dB (default: -40 dB)
        min_silence_duration (float): Minimum silence duration in seconds (default: 0.1s)
    
    Returns:
        np.ndarray: Trimmed audio signal
    
    Example:
        >>> trimmed = trim_silence(audio_data, 44100)
    """
    # Convert threshold from dB to linear amplitude
    threshold_linear = 10 ** (threshold_db / 20)
    
    # Find non-silent regions
    non_silent = np.abs(data) > threshold_linear
    
    # Find first and last non-silent samples
    non_silent_indices = np.where(non_silent)[0]
    
    if len(non_silent_indices) == 0:
        # Entire signal is silent
        return data
    
    start_idx = non_silent_indices[0]
    end_idx = non_silent_indices[-1] + 1
    
    # Trim the signal
    trimmed = data[start_idx:end_idx]
    
    print(f"✓ Trimmed silence: {start_idx} samples from start, {len(data) - end_idx} from end")
    
    return trimmed


def split_audio_channels(data):
    """
    Split stereo/multi-channel audio into separate channel arrays.
    
    Args:
        data (np.ndarray): Audio data (2D array)
    
    Returns:
        list: List of 1D arrays, one per channel
    
    Example:
        >>> left, right = split_audio_channels(stereo_data)
    """
    if len(data.shape) == 1:
        # Already mono
        return [data]
    
    if len(data.shape) == 2:
        # Split channels
        channels = [data[:, i] for i in range(data.shape[1])]
        print(f"✓ Split into {len(channels)} channels")
        return channels
    
    raise ValueError(f"Unexpected audio data shape: {data.shape}")


def merge_audio_channels(channels):
    """
    Merge separate channel arrays into multi-channel audio.
    
    Args:
        channels (list): List of 1D arrays (one per channel)
    
    Returns:
        np.ndarray: 2D array (multi-channel audio)
    
    Example:
        >>> stereo = merge_audio_channels([left_channel, right_channel])
    """
    if len(channels) == 1:
        # Single channel, return as 1D
        return channels[0]
    
    # Stack channels as columns
    merged = np.column_stack(channels)
    print(f"✓ Merged {len(channels)} channels")
    return merged


# ============================================================================
# Testing & Validation Functions
# ============================================================================

def validate_audio_format(filepath):
    """
    Check if a file is a valid audio format supported by soundfile.
    
    Args:
        filepath (str): Path to check
    
    Returns:
        bool: True if valid, False otherwise
    """
    try:
        info = sf.info(filepath)
        return True
    except:
        return False


if __name__ == "__main__":
    """
    Quick test of the signal_io module.
    Run this file directly to test functionality.
    """
    print("=" * 60)
    print("Signal I/O Module - Self Test")
    print("=" * 60)
    
    # Test 1: Create a synthetic test signal
    print("\n[Test 1] Creating synthetic test signal...")
    sample_rate = 44100
    duration = 2.0  # seconds
    t = np.linspace(0, duration, int(sample_rate * duration))
    
    # Generate a 440 Hz sine wave (musical note A)
    test_signal = np.sin(2 * np.pi * 440 * t)
    
    # Save it
    test_file = "test_signal_io.wav"
    save_signal(test_file, test_signal, sample_rate)
    
    # Test 2: Load it back
    print("\n[Test 2] Loading the signal back...")
    loaded_data, loaded_sr = load_signal(test_file)
    
    # Verify
    assert loaded_sr == sample_rate, "Sample rate mismatch!"
    assert len(loaded_data) == len(test_signal), "Length mismatch!"
    print("✓ Load/Save test passed!")
    
    # Test 3: Mono conversion
    print("\n[Test 3] Testing stereo to mono conversion...")
    stereo_signal = np.column_stack([test_signal, test_signal * 0.5])
    mono_signal = convert_to_mono(stereo_signal)
    assert len(mono_signal.shape) == 1, "Should be 1D!"
    print("✓ Mono conversion test passed!")
    
    # Test 4: Normalization
    print("\n[Test 4] Testing normalization...")
    loud_signal = test_signal * 5.0  # Make it too loud
    normalized = normalize_signal(loud_signal)
    assert np.max(np.abs(normalized)) <= 1.0, "Should be normalized!"
    print("✓ Normalization test passed!")
    
    # Test 5: Get audio info
    print("\n[Test 5] Testing audio info retrieval...")
    info = get_audio_info(test_file)
    print(f"  File info: {info}")
    print("✓ Audio info test passed!")
    
    # Clean up
    if os.path.exists(test_file):
        os.remove(test_file)
        print(f"\n✓ Cleaned up test file: {test_file}")
    
    print("\n" + "=" * 60)
    print("✓✓✓ ALL TESTS PASSED! ✓✓✓")
    print("=" * 60)
