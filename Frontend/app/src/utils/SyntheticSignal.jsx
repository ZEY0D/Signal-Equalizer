/**
 * SyntheticSignalGenerator
 * ------------------------
 * This class generates a synthetic audio signal composed of known pure frequencies.
 * Useful for testing an equalizer or audio processing, because each frequency
 * is well-defined and predictable.
 */
export class SyntheticSignalGenerator {
  constructor() {
    // Frequencies in Hz we want to include in the synthetic signal
    this.frequencies = [
      50, // Very low frequency (deep kick drum)
      100, // Low frequency (drums)
      250, // Low-mid frequency (bass guitar)
      500, // Mid frequency (piano)
      1000, // Mid-high frequency (human voice)
      2000, // High frequency (violin)
      4000, // Very high frequency (bells)
      8000, // Very high frequency (sharp sounds)
      12000, // Very high frequency (fine details)
    ];

    // Corresponding amplitudes for each frequency (0.0 - 1.0)
    this.amplitudes = [0.3, 0.5, 0.4, 0.6, 0.8, 0.5, 0.4, 0.3, 0.2];

    this.duration = 5; // Duration of signal in seconds
    this.sampleRate = 44100; // Samples per second
  }

  /**
   * generateSignal
   * ------------------------
   * Create the synthetic signal as a Float32Array.
   * Combines multiple sine waves of different frequencies and amplitudes.
   */
  generateSignal() {
    const length = this.duration * this.sampleRate; // total number of samples
    const signal = new Float32Array(length);

    console.log(
      "🎵 Generating synthetic signal with frequencies:",
      this.frequencies
    );

    for (let i = 0; i < length; i++) {
      let sample = 0;
      const time = i / this.sampleRate; // current time in seconds

      // Add each frequency's sine wave to the current sample
      this.frequencies.forEach((freq, index) => {
        const amplitude = this.amplitudes[index];
        sample += amplitude * Math.sin(2 * Math.PI * freq * time);
      });

      // Normalize the combined signal to avoid clipping
      signal[i] = sample / this.frequencies.length;
    }

    return {
      signal,
      sampleRate: this.sampleRate,
      duration: this.duration,
      frequencies: this.frequencies,
      amplitudes: this.amplitudes,
      metadata: {
        description: "Synthetic test signal with pure frequencies",
        totalFrequencies: this.frequencies.length,
        frequencyRange: `${Math.min(...this.frequencies)}Hz - ${Math.max(
          ...this.frequencies
        )}Hz`,
        purpose: "Testing equalizer behavior on known frequencies",
      },
    };
  }

  /**
   * generateWavFile
   * ------------------------
   * Converts the generated signal into a WAV file Blob for download or playback.
   */
  async generateWavFile() {
    const synthetic = this.generateSignal();
    const wavBuffer = this.createWavBuffer(
      synthetic.signal,
      synthetic.sampleRate
    );

    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);

    return {
      url,
      filename: "synthetic_test_signal.wav",
      metadata: synthetic.metadata,
      frequencies: synthetic.frequencies,
      amplitudes: synthetic.amplitudes,
    };
  }

  /**
   * createWavBuffer
   * ------------------------
   * Converts a Float32Array audio signal into a WAV format ArrayBuffer.
   * Uses 16-bit PCM encoding.
   */
  createWavBuffer(audioData, sampleRate) {
    const length = audioData.length;
    const buffer = new ArrayBuffer(44 + length * 2); // WAV header + data
    const view = new DataView(buffer);

    // Helper function to write ASCII strings into the DataView
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // Write WAV header
    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * 2, true); // file size minus 8 bytes
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // PCM header size
    view.setUint16(20, 1, true); // Audio format 1 = PCM
    view.setUint16(22, 1, true); // Number of channels = 1 (mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, "data");
    view.setUint32(40, length * 2, true); // Data chunk size

    // Write audio samples
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i])); // clamp to [-1,1]
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }

    return buffer;
  }
}

/**
 * createSyntheticAudioBuffer
 * ------------------------
 * Helper function to generate an AudioBuffer from the synthetic signal
 * directly for use in Web Audio API.
 */
export const createSyntheticAudioBuffer = async (audioContext) => {
  const generator = new SyntheticSignalGenerator();
  const synthetic = generator.generateSignal();

  const audioBuffer = audioContext.createBuffer(
    1,
    synthetic.signal.length,
    synthetic.sampleRate
  );
  audioBuffer.getChannelData(0).set(synthetic.signal);

  // Store metadata inside the buffer for later verification
  audioBuffer.metadata = {
    isSynthetic: true,
    frequencies: synthetic.frequencies,
    amplitudes: synthetic.amplitudes,
    description: "Synthetic test signal for equalizer validation",
  };

  console.log(
    "🔬 Synthetic signal created with frequencies:",
    synthetic.frequencies
  );
  return audioBuffer;
};