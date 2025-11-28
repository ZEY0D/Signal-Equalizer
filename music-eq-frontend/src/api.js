// // // const BASE = "http://localhost:8000";

// // // export const getSignal = async () => {
// // //   const r = await fetch(`${BASE}/get-signal`);
// // //   return r.json();
// // // };

// // // export const applyGain = async (sliderIndex, gain) => {
// // //   const r = await fetch(`${BASE}/apply?slider_index=${sliderIndex}&gain=${gain}`, {
// // //     method: "POST"
// // //   });
// // //   return r.json();
// // // };
// // // src/api.js
// // import axios from "axios";

// // const API_BASE_URL = "http://localhost:8000/api";

// // /**
// //  * Uploads a file and initializes a session.
// //  * @param {File} file - The audio file to upload.
// //  * @returns {Promise<string>} The session_id.
// //  */
// // export const uploadFileAndStartSession = async (file) => {
// //     const formData = new FormData();
// //     formData.append("file", file);
    
// //     const res = await axios.post(`${API_BASE_URL}/upload`, formData);
// //     return res.data.session_id;
// // };

// // /**
// //  * Fetches the latest data for all three graphs (Time, Freq, Spectrogram).
// //  */
// // export const fetchAllData = async (sessionId) => {
// //     const res = await axios.get(`${API_BASE_URL}/get-data?session_id=${sessionId}`);
// //     return res.data;
// // };

// // /**
// //  * Updates a slider gain value on the backend.
// //  */
// // export const updateGain = async (sessionId, index, value) => {
// //     const res = await axios.post(`${API_BASE_URL}/update-gain?session_id=${sessionId}&index=${index}&value=${value}`);
// //     return res.data;
// // };

// // /**
// //  * Changes the equalizer mode and resets gains.
// //  * @param {string} mode - 'music', 'animals', etc.
// //  * @returns {Promise<{labels: string[]}>} The new slider labels.
// //  */
// // export const changeMode = async (sessionId, mode) => {
// //     const res = await axios.post(`${API_BASE_URL}/change-mode?session_id=${sessionId}&mode=${mode}`);
// //     return res.data; // contains {labels: [], ranges: []}
// // };

// // /**
// //  * Generates the URL for the processed audio file.
// //  */
// // export const getAudioUrl = (sessionId) => {
// //     // Add a unique timestamp to force browser to reload the audio when the signal changes
// //     return `${API_BASE_URL}/audio?session_id=${sessionId}&t=${Date.now()}`;
// // };
// import axios from "axios";

// const API_BASE_URL = "http://localhost:8000/api";

// // 1. Upload File
// export const uploadFileAndStartSession = async (file) => {
//     const formData = new FormData();
//     formData.append("file", file);
//     const res = await axios.post(`${API_BASE_URL}/upload`, formData);
//     return res.data.session_id; // [cite: 37]
// };

// // 2. Process Signal (The BIG change)
// // Instead of sending one slider index, we send the whole configuration
// export const processSignal = async (sessionId, slidersConfiguration) => {
//     // slidersConfiguration must look like: 
//     // [{ center_freq: 200, width: 100, gain: 5 }, { ... }]
    
//     const payload = {
//         session_id: sessionId,
//         sliders: slidersConfiguration
//     };

//     const res = await axios.post(`${API_BASE_URL}/process`, payload);
//     return res.data; // [cite: 25]
// };

// // 3. Get Data for Graphs
// export const fetchSignalData = async (sessionId, type = "output") => {
//     // type is 'input' or 'output'
//     const res = await axios.get(`${API_BASE_URL}/signal/${type}?session_id=${sessionId}`);
//     return res.data; //
// };

// export const fetchFFT = async (sessionId) => {
//     const res = await axios.get(`${API_BASE_URL}/fft/compute?session_id=${sessionId}`);
//     return res.data; //
// };
import axios from "axios";

// NOTE: Set this to your actual backend URL when running locally or deployed.
const API_BASE_URL = "http://localhost:8000/api";

// --- Frontend Configuration for Modes (Mirrors your modes_config.json) ---
const MODES_CONFIG = {
    "music": {
      "labels": ["Bass", "Low-Mid", "High-Mid", "Treble"],
      "ranges": [
        [20, 250],
        [250, 2000],
        [2000, 6000],
        [6000, 16000]
      ]
    },
    "animals": {
      "labels": ["Whale", "Dog", "Cat", "Bat"],
      "ranges": [
        [10, 100],
        [300, 600],
        [700, 1500],
        [2548.12, 8530.80]
      ]
    },
    "human": {
      "labels": ["Voice 1", "Voice 2", "Voice 3", "Voice 4"],
      "ranges": [
        [200, 300],
        [400, 700],
        [800, 1200],
        [3000, 15000]
      ]
    }
};

/**
 * Retrieves the labels and the calculated center_freq/width for a mode.
 * @param {string} mode - The mode name (e.g., 'music', 'animals').
 * @returns {{labels: string[], initialSliders: object[]}}
 */
export const getModeConfig = (mode) => {
    const config = MODES_CONFIG[mode];
    if (!config) {
        // Fallback for missing mode config
        return {
            labels: ["Error", "Loading", "Mode", "Failed"],
            initialSliders: []
        };
    }

    // Convert [start, end] ranges into {center_freq, width, gain} required by the backend
    const initialSliders = config.ranges.map(range => {
        const [start, end] = range;
        const center_freq = (start + end) / 2;
        const width = end - start;
        return {
            center_freq: center_freq,
            width: width,
            gain: 1.0 // Unity gain (no change) - this is linear, not dB
        };
    });

    return {
        labels: config.labels,
        initialSliders: initialSliders
    };
};

// 1. Upload File
export const uploadFileAndStartSession = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await axios.post(`${API_BASE_URL}/upload`, formData);
        return res.data.session_id; 
    } catch (error) {
        console.error("Error during file upload:", error);
        throw new Error("Failed to upload file.");
    }
};

/**
 * 2. Sends the current slider configuration (freq/width/gain) to the backend
 * to apply the equalizer effect and reconstruct the signal.
 */
export const processSignal = async (sessionId, slidersConfiguration) => {
    const payload = {
        session_id: sessionId,
        sliders: slidersConfiguration
    };
    try {
        const res = await axios.post(`${API_BASE_URL}/process`, payload);
        // Assuming backend returns image URLs for spectrograms here
        return {
            inputSpectrogram: res.data.input_spectrogram_url || '',
            outputSpectrogram: res.data.output_spectrogram_url || ''
        };
    } catch (error) {
        console.error("Error during signal processing:", error);
        throw new Error("Failed to process signal.");
    }
};

/**
 * 3. Fetches the waveform data for the time domain chart.
 */
export const fetchSignalData = async (sessionId, type = "output") => {
    try {
        // We assume the signal endpoint returns the raw waveform data
        const res = await axios.get(`${API_BASE_URL}/signal/${type}?session_id=${sessionId}`);
        return res.data;
    } catch (error) {
        console.error(`Error fetching ${type} signal data:`, error);
        throw new Error(`Failed to fetch ${type} signal data.`);
    }
};

/**
 * 4. Fetches the FFT data (magnitudes and frequencies) for the frequency chart.
 */
export const fetchFFT = async (sessionId, type = "output") => {
    try {
        // We assume the FFT endpoint returns the magnitude array
        const res = await axios.get(`${API_BASE_URL}/fft/compute/${type}?session_id=${sessionId}`);
        return res.data; 
    } catch (error) {
        console.error("Error fetching FFT data:", error);
        throw new Error("Failed to fetch FFT data.");
    }
};

/**
 * 5. Generates the URL for the processed audio file.
 */
export const getAudioUrl = (sessionId, type = "output") => {
    // Add a unique timestamp (t=...) to force browser to reload the audio when the signal changes
    return `${API_BASE_URL}/audio/${type}?session_id=${sessionId}&t=${Date.now()}`;
};