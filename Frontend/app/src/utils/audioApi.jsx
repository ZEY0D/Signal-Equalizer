// src/utils/audioApi.js
/**
 * API utilities for communicating with FastAPI backend
 */

const API_BASE_URL = "http://localhost:8000";

/**
 * Process audio using the backend FFT engine
 */
export const processAudioWithBackend = async (
  audioBuffer,
  bands,
  gainArray,
  mode = "generic"
) => {
  try {
    // Extract audio data from buffer
    const audioData = Array.from(audioBuffer.getChannelData(0));

    // Prepare request
    const requestData = {
      audioData,
      gainArray: Array.from(gainArray),
      sampleRate: audioBuffer.sampleRate,
      bands: bands.map((band) => ({
        center_freq: band.centerFreq,
        width: band.width,
        gain: band.gain,
      })),
      mode,
    };

    // Send to backend
    const response = await fetch(`${API_BASE_URL}/api/process-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Backend error: ${response.status}`);
    }

    const result = await response.json();

    return {
      processedAudio: result.processedAudio,
      frequencies: result.frequencies,
      magnitudes: result.magnitudes,
      metadata: result.metadata,
    };
  } catch (error) {
    console.error("Backend processing failed:", error);
    throw error;
  }
};

/**
 * Upload audio file to backend (for session-based processing)
 */
export const uploadAudioFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

    const result = await response.json();
    return result.session_id;
  } catch (error) {
    console.error("Upload failed:", error);
    throw error;
  }
};

/**
 * Compute FFT for a session
 */
export const computeFFT = async (sessionId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/compute-fft/${sessionId}`, {
      method: "POST",
    });

    if (!response.ok)
      throw new Error(`FFT computation failed: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error("FFT computation failed:", error);
    throw error;
  }
};

/**
 * Apply equalizer to a session
 */
export const applyEqualizerToSession = async (sessionId, sliders) => {
  try {
    const requestData = {
      session_id: sessionId,
      sliders: sliders.map((slider) => ({
        center_freq: slider.centerFreq,
        width: slider.width,
        gain: slider.gain,
      })),
    };

    const response = await fetch(`${API_BASE_URL}/apply-equalizer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) throw new Error(`Equalizer failed: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error("Equalizer application failed:", error);
    throw error;
  }
};

/**
 * Download processed audio from session
 */
export const downloadProcessedAudio = (sessionId) => {
  window.location.href = `${API_BASE_URL}/download/${sessionId}`;
};

/**
 * Check if backend is available
 */
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/`, {
      method: "GET",
    });

    if (!response.ok) return false;

    const result = await response.json();
    return result.status === "online";
  } catch (error) {
    console.error("Backend health check failed:", error);
    return false;
  }
};
