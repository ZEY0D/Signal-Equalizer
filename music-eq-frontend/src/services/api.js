/**
 * API Service Layer - Signal Equalizer
 * Connects React frontend to FastAPI backend
 * 
 * Base URL: http://localhost:8000
 */

const API_BASE_URL = 'http://localhost:8000';

/**
 * Generic request handler with error handling
 */
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Upload audio file
 * @param {File} file - Audio file to upload
 * @returns {Promise<{session_id, filename, sample_rate, duration, length, message}>}
 */
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to upload file');
  }

  return await response.json();
}

/**
 * Create synthetic test signal
 * @param {Object} params - Signal parameters
 * @param {Array<number>} params.frequencies - List of frequencies in Hz
 * @param {number} params.duration - Duration in seconds
 * @param {number} params.sample_rate - Sampling rate in Hz
 * @param {string} params.session_id - Optional session ID
 * @returns {Promise<{session_id, sample_rate, duration, length, message}>}
 */
export async function createSyntheticSignal({
  frequencies = [100, 500, 1000, 2000],
  duration = 2.0,
  sample_rate = 44100,
  session_id = null,
}) {
  return apiRequest('/api/synthetic', {
    method: 'POST',
    body: JSON.stringify({
      session_id,
      frequencies,
      duration,
      sample_rate,
    }),
  });
}

/**
 * Compute FFT for the loaded signal
 * @param {string} sessionId - Session identifier
 * @param {boolean} positiveOnly - Return only positive frequencies
 * @returns {Promise<{frequencies, magnitudes, phases, length}>}
 */
export async function computeFFT(sessionId, positiveOnly = true) {
  return apiRequest(
    `/api/fft/compute?session_id=${sessionId}&positive_only=${positiveOnly}`,
    {
      method: 'GET',
    }
  );
}

/**
 * Compute FFT for the OUTPUT (processed) signal
 * @param {string} sessionId - Session identifier
 * @param {boolean} positiveOnly - Return only positive frequencies
 * @returns {Promise<{frequencies, magnitudes, phases, length}>}
 */
export async function getOutputFFT(sessionId, positiveOnly = true) {
  return apiRequest(
    `/api/fft/output?session_id=${sessionId}&positive_only=${positiveOnly}`,
    {
      method: 'GET',
    }
  );
}

/**
 * Get input signal data
 * @param {string} sessionId - Session identifier
 * @param {number} maxPoints - Maximum points to return (for downsampling)
 * @param {boolean} full - If true, return full signal without downsampling (for audio)
 * @returns {Promise<{signal, time_axis, sample_rate, length, start, end}>}
 */
export async function getInputSignal(sessionId, maxPoints = 10000, full = false) {
  return apiRequest(
    `/api/signal/input?session_id=${sessionId}&max_points=${maxPoints}&full=${full}`,
    {
      method: 'GET',
    }
  );
}

/**
 * Get output (processed) signal data
 * @param {string} sessionId - Session identifier
 * @param {number} maxPoints - Maximum points to return (for downsampling)
 * @param {boolean} full - If true, return full signal without downsampling (for audio)
 * @returns {Promise<{signal, time_axis, sample_rate, length, start, end}>}
 */
export async function getOutputSignal(sessionId, maxPoints = 10000, full = false) {
  return apiRequest(
    `/api/signal/output?session_id=${sessionId}&max_points=${maxPoints}&full=${full}`,
    {
      method: 'GET',
    }
  );
}

/**
 * Get input signal spectrogram
 * @param {string} sessionId - Session identifier
 * @param {number} windowSize - FFT window size
 * @param {number} overlap - Overlap ratio (0.0 to 1.0)
 * @returns {Promise<{times, frequencies, magnitude, sample_rate}>}
 */
export async function getInputSpectrogram(sessionId, windowSize = 1024, overlap = 0.75) {
  return apiRequest(
    `/api/spectrogram/input?session_id=${sessionId}&window_size=${windowSize}&overlap=${overlap}`,
    {
      method: 'GET',
    }
  );
}

/**
 * Get output (processed) signal spectrogram
 * @param {string} sessionId - Session identifier
 * @param {number} windowSize - FFT window size
 * @param {number} overlap - Overlap ratio (0.0 to 1.0)
 * @returns {Promise<{times, frequencies, magnitude, sample_rate}>}
 */
export async function getOutputSpectrogram(sessionId, windowSize = 1024, overlap = 0.75) {
  return apiRequest(
    `/api/spectrogram/output?session_id=${sessionId}&window_size=${windowSize}&overlap=${overlap}`,
    {
      method: 'GET',
    }
  );
}

/**
 * Process signal with slider settings
 * @param {string} sessionId - Session identifier
 * @param {Array<Object>} sliders - Slider configurations
 * @param {number} sliders[].center_freq - Center frequency in Hz
 * @param {number} sliders[].width - Width of frequency range in Hz
 * @param {number} sliders[].gain - Gain value (0 to 2)
 * @returns {Promise<{message, output_length, frequencies, magnitudes, max_magnitude}>}
 */
export async function processSignal(sessionId, sliders) {
  console.log('🚀 API: Sending sliders to backend:', JSON.stringify(sliders, null, 2));
  return apiRequest('/api/process', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      sliders,
    }),
  });
}

/**
 * Reset signal to original state
 * @param {string} sessionId - Session identifier
 * @returns {Promise<{message}>}
 */
export async function resetSignal(sessionId) {
  return apiRequest('/api/reset', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
    }),
  });
}

/**
 * Save slider configuration
 * @param {string} sessionId - Session identifier
 * @param {string} configName - Name for the configuration
 * @param {Object} config - Configuration object containing mode and sliders
 * @returns {Promise<{message, config_path}>}
 */
export async function saveConfig(sessionId, configName, config) {
  return apiRequest('/api/config/save', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      config_name: configName,
      config,
    }),
  });
}

/**
 * Load slider configuration
 * @param {string} configName - Name of configuration to load
 * @returns {Promise<{config, config_name, message}>}
 */
export async function loadConfig(configName) {
  return apiRequest(`/api/config/load?config_name=${configName}`, {
    method: 'GET',
  });
}

/**
 * List all saved configurations
 * @returns {Promise<{configs: Array<string>}>}
 */
export async function listConfigs() {
  return apiRequest('/api/config/list', {
    method: 'GET',
  });
}

/**
 * Health check - verify backend is running
 * @returns {Promise<{status, message, active_sessions}>}
 */
export async function healthCheck() {
  return apiRequest('/api/health', {
    method: 'GET',
  });
}

export default {
  uploadFile,
  createSyntheticSignal,
  computeFFT,
  getInputSignal,
  getOutputSignal,
  processSignal,
  resetSignal,
  saveConfig,
  loadConfig,
  listConfigs,
  healthCheck,
};
