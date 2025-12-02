import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import GenericMode from "./components/GenericMode";
import Spectrogram from "./components-generic/Spectrogram";
import { FrequencyGraph } from "./components-generic/FrequencyGraph";
import EqualizerSliders from "./components/EqualizerSliders";

// ===============================================
// API Services (Integrated from src/api.js)
// ===============================================
const API_BASE_URL = "http://localhost:8000/api";

// --- Frontend Configuration for Modes (Mirrors your modes_config.json) ---
// Note: Frontend config is used to derive initial filter parameters (center_freq, width)
const MODES_CONFIG = {
  music: {
    labels: ["Drums", "Bass", "Vocals", "Piano"],
    ranges: [
      [30, 260],
      [45, 230],
      [630, 1000],
      [313, 620],
    ],
  },
  animals: {
    labels: ["Lion", "Bird", "Cat", "Dog"],
    ranges: [
      [5.2, 210.5],
      [4000.09, 5650.95],
      [1212.0, 1600.0],
      [400.0, 1200.0],
    ],
  },
  human: {
    labels: ["Voice 1", "Voice 2", "Voice 3", "Voice 4"],
    ranges: [
      [60, 250],
      [250, 500],
      [500, 2000],
      [2000, 20000],
    ],
  },
};

/**
 * Retrieves the labels and the calculated center_freq/width for a mode.
 */
const getModeConfig = (mode) => {
  const config = MODES_CONFIG[mode];
  if (!config) {
    return {
      labels: ["Error", "Loading", "Mode", "Failed"],
      initialSliders: [],
    };
  }

  const initialSliders = config.ranges.map((range) => {
    const [start, end] = range;
    const center_freq = (start + end) / 2;
    const width = end - start;
    return {
      center_freq: center_freq,
      width: width,
      gain: 0, // 0 dB = 1.0x linear multiplier (no change)
    };
  });

  return {
    labels: config.labels,
    initialSliders: initialSliders,
  };
};

// 1. Upload File
const uploadFileAndStartSession = async (file) => {
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
 * 2. Sends the current slider configuration to backend for temporary storage.
 * Does NOT trigger processing - just saves the state (FAST).
 */
const updateSlidersBackend = async (sessionId, slidersConfiguration) => {
  const payload = {
    session_id: sessionId,
    sliders: slidersConfiguration,
  };
  try {
    const res = await axios.post(`${API_BASE_URL}/update-sliders`, payload);
    return res.data;
  } catch (error) {
    console.error("Error updating sliders:", error);
    throw new Error("Failed to update sliders.");
  }
};

/**
 * 3. Applies the slider configuration and runs FFT→Gain→IFFT.
 * This is the heavy operation - only called when user clicks 'Apply Changes'.
 */
const processSignal = async (sessionId, slidersConfiguration) => {
  const payload = {
    session_id: sessionId,
    sliders: slidersConfiguration,
  };
  try {
    const res = await axios.post(`${API_BASE_URL}/process`, payload);
    return {
      inputSpectrogram: res.data.input_spectrogram_url || "",
      outputSpectrogram: res.data.output_spectrogram_url || "",
    };
  } catch (error) {
    console.error("Error during signal processing:", error);
    throw new Error("Failed to process signal.");
  }
};

/**
 * 4. Fetches the waveform data for the time domain chart.
 */
const fetchSignalData = async (sessionId, type = "output") => {
  try {
    const res = await axios.get(
      `${API_BASE_URL}/signal/${type}?session_id=${sessionId}`
    );
    return res.data;
  } catch (error) {
    // Log 404 errors but continue, as the backend might not have the resource yet
    if (error.response && error.response.status === 404) {
      console.warn(`Signal data for ${type} not yet available (404).`);
      return { signal: [] };
    }
    console.error(`Error fetching ${type} signal data:`, error);
    throw new Error(`Failed to fetch ${type} signal data.`);
  }
};

/**
 * 5. Fetches the FFT data (magnitudes and frequencies) for the frequency chart.
 */
const fetchFFT = async (sessionId, type = "output") => {
  try {
    const res = await axios.get(
      `${API_BASE_URL}/fft/compute/${type}?session_id=${sessionId}`
    );
    return res.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.warn(`FFT data for ${type} not yet available (404).`);
      return { magnitudes: [] };
    }
    console.error("Error fetching FFT data:", error);
    throw new Error("Failed to fetch FFT data.");
  }
};

/**
 * 6. Generates the URL for the processed audio file.
 * IMPORTANT: Added Date.now() to force the browser to request a fresh copy,
 * mitigating caching issues when the signal is re-processed.
 */
const getAudioUrl = (sessionId, type = "output") => {
  if (!sessionId) return "";
  // Use Date.now() to ensure the browser fetches the new file after processing
  return `${API_BASE_URL}/audio/${type}?session_id=${sessionId}&t=${Date.now()}`;
};

// ===============================================
// Component: CinePlayer (Time Domain Viewer)
// ===============================================
const CinePlayer = ({
  data,
  audioSrc,
  type,
  viewWindow,
  onViewChange,
  audioRef,
}) => {
  // Debug: log CinePlayer inputs to verify correct bindings
  // (will print to console; remove when no longer needed)
  console.log(`CinePlayer ${type}:`, {
    dataLength: data?.length ?? 0,
    audioSrc,
    viewWindow,
  });
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Check if data is available to prevent interaction errors
  const hasData = data && data.length > 0;

  // --- Drawing Logic ---
  const drawWaveform = useCallback(
    (canvas, data, xMin, xMax) => {
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (!hasData) {
        ctx.fillStyle = "#666";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`No ${type} Signal Loaded`, width / 2, height / 2);
        return;
      }

      const startIdx = Math.floor(data.length * xMin);
      const endIdx = Math.floor(data.length * xMax);
      const visibleLength = endIdx - startIdx;

      ctx.strokeStyle = type === "input" ? "#4A90E2" : "#F5A623"; // Blue for Input, Orange for Output
      ctx.lineWidth = 1;
      ctx.beginPath();

      const maxPoints = 1000;
      const step = Math.ceil(visibleLength / maxPoints);

      for (let i = 0; i < visibleLength; i += step) {
        const dataIndex = startIdx + i;
        if (dataIndex >= data.length) break;

        const x = (i / visibleLength) * width;
        const y = (0.5 - data[dataIndex] * 0.5) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    },
    [type, hasData]
  );

  // --- Effects and Initial Setup ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Make the canvas responsive to its parent size
    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height - 50;
    drawWaveform(canvas, data, viewWindow.xMin, viewWindow.xMax);
  }, [data, viewWindow, drawWaveform]);

  // --- Playback Handlers (Removed dedicated play/pause button, relies on HTML5 controls) ---
  // Instead of controlling playback, we will listen to audio time updates to keep the view linked.

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || type !== "output" || !hasData) return;

    const updateView = () => {
      const duration = audio.duration;
      if (duration && audio.currentTime > 0) {
        const centerTime = audio.currentTime;
        // Span should be proportional to the screen width, let's use a fixed 10% view span for playback
        const viewSpan = 0.1 * duration;
        let newXMin = (centerTime - viewSpan / 2) / duration;
        let newXMax = (centerTime + viewSpan / 2) / duration;

        // Keep the view within [0, 1] bounds
        if (newXMin < 0) {
          newXMax -= newXMin;
          newXMin = 0;
        }
        if (newXMax > 1) {
          newXMin -= newXMax - 1;
          newXMax = 1;
        }
        onViewChange({ xMin: newXMin, xMax: newXMax });
      }
    };

    // Note: The audio for CinePlayer only plays in the Output view
    const interval = setInterval(updateView, 50); // Update view 20 times per second

    return () => clearInterval(interval);
  }, [audioRef, hasData, type, onViewChange]);

  // --- Zoom/Pan Handlers (updates parent state via onViewChange) ---
  const handleZoom = (direction) => {
    if (!hasData) return;
    const center = (viewWindow.xMin + viewWindow.xMax) / 2;
    let newSpan = viewWindow.xMax - viewWindow.xMin;

    if (direction === "in") {
      newSpan = Math.max(0.01, newSpan * 0.5);
    } else {
      // 'out'
      newSpan = Math.min(1.0, newSpan * 2.0);
    }

    const newXMin = Math.max(0, center - newSpan / 2);
    const newXMax = Math.min(1, center + newSpan / 2);

    onViewChange({ xMin: newXMin, xMax: newXMax });
  };

  // Simple drag panning logic
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startViewWindow = useRef({ xMin: 0, xMax: 1 });

  const handleMouseDown = (e) => {
    if (!hasData) return; // Prevent interaction if no data
    isDragging.current = true;
    startX.current = e.clientX;
    startViewWindow.current = viewWindow;
    e.currentTarget.style.cursor = "grabbing";
  };

  const handleMouseUp = (e) => {
    if (!hasData) return;
    isDragging.current = false;
    e.currentTarget.style.cursor = "grab";
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current || !hasData) return;

    const deltaX = e.clientX - startX.current;
    const canvasWidth = canvasRef.current.width;

    const viewSpan =
      startViewWindow.current.xMax - startViewWindow.current.xMin;
    const dragRatio = deltaX / canvasWidth;
    const signalShift = dragRatio * viewSpan;

    let newXMin = startViewWindow.current.xMin - signalShift;
    let newXMax = startViewWindow.current.xMax - signalShift;

    if (newXMin < 0) {
      newXMax -= newXMin;
      newXMin = 0;
    } else if (newXMax > 1) {
      newXMin -= newXMax - 1;
      newXMax = 1;
    }

    onViewChange({ xMin: newXMin, xMax: newXMax });
  };

  const containerStyle = {
    flexGrow: 1,
    minHeight: "250px",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    cursor: hasData ? "grab" : "default", // Change cursor if interactive
  };

  const canvasStyle = {
    width: "100%",
    height: "100%",
    display: "block",
    minHeight: "200px",
  };

  const buttonContainerStyle = {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    paddingTop: "10px",
  };

  const buttonStyle = {
    padding: "8px 15px",
    borderRadius: "4px",
    backgroundColor: type === "input" ? "#4A90E2" : "#F5A623",
    color: "white",
    border: "none",
    cursor: hasData ? "pointer" : "not-allowed",
    fontSize: "0.9rem",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    transition: "background-color 0.15s",
    opacity: hasData ? 1 : 0.5,
  };

  return (
    <div
      style={containerStyle}
      onMouseDown={hasData ? handleMouseDown : undefined}
      onMouseUp={hasData ? handleMouseUp : undefined}
      onMouseLeave={hasData ? handleMouseUp : undefined}
      onMouseMove={hasData ? handleMouseMove : undefined}
    >
      <canvas ref={canvasRef} style={canvasStyle} />

      <div style={buttonContainerStyle}>
        <button
          style={buttonStyle}
          onClick={() => handleZoom("in")}
          disabled={!hasData || viewWindow.xMax - viewWindow.xMin <= 0.01}
        >
          Zoom In (+)
        </button>
        <button
          style={buttonStyle}
          onClick={() => handleZoom("out")}
          disabled={!hasData || viewWindow.xMax - viewWindow.xMin >= 1.0}
        >
          Zoom Out (-)
        </button>
        <button
          style={buttonStyle}
          onClick={() => onViewChange({ xMin: 0, xMax: 1 })}
          disabled={
            !hasData || (viewWindow.xMin === 0 && viewWindow.xMax === 1)
          }
        >
          Reset View
        </button>
      </div>
    </div>
  );
};

// EqualizerSliders component moved to `src/components/EqualizerSliders.jsx`.

// ===============================================
// Main App Component
// ===============================================

// --- Integrated Styles ---
const styles = {
  container: {
    padding: "20px",
    background: "#121212",
    minHeight: "100vh", // Full screen height
    width: "100vw", // Full screen width
    color: "#eee",
    fontFamily: "Inter, sans-serif",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    gap: "20px",
    alignItems: "center",
    marginBottom: "20px",
  },
  select: {
    padding: "5px",
    fontSize: "1rem",
    borderRadius: "4px",
    backgroundColor: "#2e2e2e",
    color: "#eee",
    border: "1px solid #444",
    cursor: "pointer",
  },
  sessionIdText: {
    fontSize: "0.8rem",
    color: "#999",
    marginLeft: "auto", // Pushes the ID to the right
    minWidth: "120px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", // Responsive grid
    gap: "20px",
    marginBottom: "30px",
  },
  card: {
    background: "#1e1e1e",
    borderRadius: "8px",
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
  },
  sliderContainer: {
    marginTop: "20px",
    background: "#1e1e1e",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
  },
  audioControls: {
    width: "100%",
    backgroundColor: "#2e2e2e",
    borderRadius: "8px",
    padding: "10px 15px",
    marginTop: "20px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
  },
};

export default function App() {
  // UI Mode: "customized" or "generic"
  const [uiMode, setUiMode] = useState("customized");

  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Data states for Input and Output signals
  const [inputWaveform, setInputWaveform] = useState([]);
  const [outputWaveform, setOutputWaveform] = useState([]);
  const [inputFftData, setInputFftData] = useState([]);
  const [outputFftData, setOutputFftData] = useState([]);
  const [inputSpectrogramData, setInputSpectrogramData] = useState(null);
  const [outputSpectrogramData, setOutputSpectrogramData] = useState(null);
  const [frequencyScale, setFrequencyScale] = useState("linear"); // For FFT visualization

  // Linked view states for CinePlayers (separate for input and output)
  const [inputViewWindow, setInputViewWindow] = useState({ xMin: 0, xMax: 1 });
  const [outputViewWindow, setOutputViewWindow] = useState({
    xMin: 0,
    xMax: 1,
  });
  const [mixedViewWindow, setMixedViewWindow] = useState({ xMin: 0, xMax: 1 });

  // Equalizer control states
  const [slidersConfig, setSlidersConfig] = useState([]);
  const [labels, setLabels] = useState([]);
  const [currentMode, setCurrentMode] = useState("music");

  // Audio references (Output audio ref is used by CinePlayer to link visualization)
  const audioRefOutput = useRef(null);
  const audioRefInput = useRef(null);

  // Derived audio URLs (Key part: dependency on sessionId and image source change)
  const [audioUrlInput, setAudioUrlInput] = useState("");
  const [audioUrlOutput, setAudioUrlOutput] = useState("");

  // Ensure the audio element uses the latest state URL and trigger load/play
  useEffect(() => {
    if (!audioUrlOutput) return;
    const node = audioRefOutput.current;
    if (!node) return;
    try {
      if (node.src !== audioUrlOutput) node.src = audioUrlOutput;
      node.load();
      node.play().catch(() => {
        console.log("Auto-play prevented, user must click play");
      });
      console.log("Audio element updated to:", audioUrlOutput);
    } catch (err) {
      console.warn("Failed to update audio element:", err);
    }
  }, [audioUrlOutput]);

  // Demucs separation state
  const [demucsProcessing, setDemucsProcessing] = useState(false);
  const [demucsStemUrls, setDemucsStemUrls] = useState(null);
  const [demucsError, setDemucsError] = useState("");

  // Demucs mixing state
  const [demucsMixedData, setDemucsMixedData] = useState(null);
  const [mixingDemucsStems, setMixingDemucsStems] = useState(false);
  const [demucsMixError, setDemucsMixError] = useState("");
  const audioRefMixed = useRef(null);

  // Human voice separation state
  const [humanProcessing, setHumanProcessing] = useState(false);
  const [humanSourceUrls, setHumanSourceUrls] = useState(null);
  const [humanError, setHumanError] = useState("");
  const [numSpeakers, setNumSpeakers] = useState(0);

  // Ref to track pending slider updates
  // (removed unused pendingUpdateRef)

  // --- 0. Initial Mode Setup ---
  useEffect(() => {
    handleChangeMode(null, currentMode);
  }, [currentMode]);

  // --- 1. Data Fetching ---
  const fetchData = async (currentSessionId, fetchType) => {
    if (!currentSessionId) return;

    try {
      // Fetch Input data if needed
      if (fetchType !== "output_only") {
        const signalDataInput = await fetchSignalData(
          currentSessionId,
          "input"
        );
        setInputWaveform(signalDataInput.signal);
        const fftInput = await fetchFFT(currentSessionId, "input");
        setInputFftData(fftInput.magnitudes);
      }

      // Fetch Output data (processed signal)
      const signalDataOutput = await fetchSignalData(
        currentSessionId,
        "output"
      );
      setOutputWaveform(signalDataOutput.signal);
      const fftOutput = await fetchFFT(currentSessionId, "output");
      setOutputFftData(fftOutput.magnitudes);
    } catch (e) {
      console.error("Error fetching signal/FFT data:", e);
    }
  };

  // --- 2. Signal Processing Helper ---
  // Added useCallback to ensure this function doesn't change unexpectedly
  const handleProcessSignal = useCallback(async (id, config) => {
    if (!id) return;
    setProcessing(true);
    try {
      // 1. Send the config to the backend
      await processSignal(id, config);

      // 2. Update all resource URLs immediately to force reload
      const newInputUrl = getAudioUrl(id, "input");
      const newOutputUrl = getAudioUrl(id, "output");

      setAudioUrlInput(newInputUrl);
      setAudioUrlOutput(newOutputUrl);

      // 2.5 Fetch spectrogram data
      try {
        const inputSpec = await axios.get(
          `${API_BASE_URL}/spectrogram/input?session_id=${id}`
        );
        setInputSpectrogramData(inputSpec.data);
      } catch (err) {
        console.warn("Could not fetch input spectrogram:", err);
      }

      try {
        const outputSpec = await axios.get(
          `${API_BASE_URL}/spectrogram/output?session_id=${id}`
        );
        setOutputSpectrogramData(outputSpec.data);
      } catch (err) {
        console.warn("Could not fetch output spectrogram:", err);
      }

      // 3. Fetch updated Waveform and FFT data (Output only for efficiency after re-processing)
      await fetchData(id, "output_only");

      // 4. Update audio URL state — audio element will be updated by effect
      console.log("Audio URL state updated (process):", newOutputUrl);
    } catch (e) {
      console.error("Error processing signal:", e);
    } finally {
      setProcessing(false);
    }
  }, []);

  // --- Demucs Separation Handler ---
  const handleDemucsSeparation = async () => {
    if (!sessionId) {
      alert("Please upload an audio file first!");
      return;
    }

    setDemucsProcessing(true);
    setDemucsError("");
    setDemucsStemUrls(null);

    try {
      console.log("Starting Demucs separation for session:", sessionId);

      const response = await axios.post(
        `${API_BASE_URL}/separate-demucs`,
        null,
        {
          params: {
            session_id: sessionId,
            model: "mdx_extra_q", // Highest quality model
          },
        }
      );

      if (response.data.success) {
        console.log("Demucs separation successful:", response.data);
        setDemucsStemUrls(response.data.stems);
      } else {
        throw new Error(response.data.message || "Separation failed");
      }
    } catch (error) {
      console.error("Demucs separation error:", error);
      const errorMsg =
        error.response?.data?.detail || error.message || "Separation failed";
      setDemucsError(errorMsg);
      alert(
        `Demucs Error: ${errorMsg}\n\nMake sure Demucs is installed: pip install demucs==3.0.6 torch==2.0.1 torchaudio==2.0.2`
      );
    } finally {
      setDemucsProcessing(false);
    }
  };

  // --- Demucs Stem Mixing Handler ---
  const handleMixDemucsStems = async () => {
    if (!sessionId) {
      alert("Please upload a file first.");
      return;
    }

    if (!demucsStemUrls) {
      alert("Please run AI separation first.");
      return;
    }

    setMixingDemucsStems(true);
    setDemucsMixError("");
    setDemucsMixedData(null);

    try {
      // Extract gains from sliders (order: Drums, Bass, Vocals, Piano)
      // Convert dB values to linear multipliers: linearGain = 10^(dB/20)
      const gains = slidersConfig.map((slider) => {
        const dB = slider.gain;
        const linearGain = Math.pow(10, dB / 20);
        return linearGain;
      });

      console.log("Mixing Demucs stems:");
      slidersConfig.forEach((slider, idx) => {
        console.log(`  ${labels[idx]}: ${slider.gain.toFixed(1)} dB → ${gains[idx].toFixed(3)}x`);
      });

      const response = await axios.post(`${API_BASE_URL}/mix-demucs-stems`, {
        session_id: sessionId,
        gains: gains,
      });

      if (response.data.success) {
        console.log("Mixing successful:", response.data);
        setDemucsMixedData(response.data);
      }
    } catch (error) {
      console.error("Mixing error:", error);
      const errorMsg =
        error.response?.data?.detail || error.message || "Unknown error";
      setDemucsMixError(errorMsg);
      alert(`Mixing Error: ${errorMsg}`);
    } finally {
      setMixingDemucsStems(false);
    }
  };

  // --- Human Voice Separation Handler ---
  const handleHumanSeparation = async (minSrc = 2, maxSrc = 4) => {
    if (!sessionId) {
      alert("Please upload an audio file first!");
      return;
    }

    setHumanProcessing(true);
    setHumanError("");
    setHumanSourceUrls(null);
    setNumSpeakers(0);

    try {
      console.log("Starting human voice separation for session:", sessionId);

      const response = await axios.post(
        `${API_BASE_URL}/separate-human`,
        null,
        {
          params: {
            session_id: sessionId,
            min_src: minSrc,
            max_src: maxSrc,
          },
        }
      );

      if (response.data.success) {
        console.log("Human separation successful:", response.data);
        setHumanSourceUrls(response.data.sources);
        setNumSpeakers(response.data.num_speakers);
      } else {
        throw new Error(response.data.message || "Separation failed");
      }
    } catch (error) {
      console.error("Human separation error:", error);
      const errorMsg =
        error.response?.data?.detail || error.message || "Separation failed";
      setHumanError(errorMsg);
      alert(
        `Human Separation Error: ${errorMsg}\n\nMake sure required packages are installed: pytorch-lightning, asteroid`
      );
    } finally {
      setHumanProcessing(false);
    }
  };




  // starting from file upload
  // --- 3. Handlers (Upload and Mode Change) ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      // 1. Upload file and get session ID
      const newSessionId = await uploadFileAndStartSession(file);
      setSessionId(newSessionId);

      // 2. Set audio URLs to display the uploaded file
      const inputUrl = getAudioUrl(newSessionId, "input");
      setAudioUrlInput(inputUrl);
      setAudioUrlOutput(inputUrl); // Initially, output = input (no processing yet)

      // 3. Fetch input data for visualization
      const signalDataInput = await fetchSignalData(newSessionId, "input");
      setInputWaveform(signalDataInput.signal);
      setOutputWaveform(signalDataInput.signal); // Initially, output = input (same reference)
      
      const fftInput = await fetchFFT(newSessionId, "input");
      setInputFftData(fftInput.magnitudes);
      setOutputFftData(fftInput.magnitudes); // Initially, output = input (same reference)

      // 4. Fetch spectrograms
      try {
        const inputSpec = await axios.get(
          `${API_BASE_URL}/spectrogram/input?session_id=${newSessionId}`
        );
        setInputSpectrogramData(inputSpec.data);
        setOutputSpectrogramData(inputSpec.data); // Initially, output = input (same reference)
      } catch (err) {
        console.warn("Could not fetch spectrogram:", err);
      }

      console.log("✅ File loaded. Output = Input (no processing applied yet)");
      console.log(`   Waveform length: ${signalDataInput.signal.length}`);
      console.log(`   FFT length: ${fftInput.magnitudes.length}`);
    } catch (e) {
      console.error(
        "Failed to upload file or start session. Check console.",
        e
      );
    } finally {
      setLoading(false);
    }
  };

  // Mode change handler
  const handleChangeMode = (id, mode) => {
    // 1. Get the mode configuration (labels and initial frequencies)
    const { labels: newLabels, initialSliders: newSlidersConfig } =
      getModeConfig(mode);

    // 2. Update frontend state
    setLabels(newLabels);
    setSlidersConfig(newSlidersConfig);
    setCurrentMode(mode);

    // 3. Clear session and audio when changing modes to force new file upload
    setSessionId(null);
    setAudioUrlInput("");
    setAudioUrlOutput("");
    setInputWaveform([]);
    setOutputWaveform([]);
    setInputFftData([]);
    setOutputFftData([]);
    setInputSpectrogramData(null);
    setOutputSpectrogramData(null);
    setDemucsStemUrls(null);
    setDemucsMixedData(null);
    setDemucsError("");
    setHumanSourceUrls(null);
    setHumanError("");
    setNumSpeakers(0);
  };

  // --- 4. Slider Change Handler (NO PROCESSING - just updates state) ---
  // Expects a linear gain (0.0 .. 2.0). Backend stores linear multipliers directly.
  const handleSliderChange = useCallback(
    (idx, linearGain) => {
      if (!sessionId || slidersConfig.length === 0) return;

      // 1. Update the local state instantly for responsive UI
      const updatedConfig = slidersConfig.map((slider, index) => {
        if (index === idx) {
          return { ...slider, gain: linearGain };
        }
        return slider;
      });

      setSlidersConfig(updatedConfig);

      // 2. Send to backend for temporary storage (FAST - no processing)
      // Payload contains linear gains (0.0 - 2.0)
      updateSlidersBackend(sessionId, updatedConfig).catch((err) => {
        console.error("Failed to update sliders:", err);
      });
    },
    [sessionId, slidersConfig]
  );

  // --- 5. Apply Changes Handler (TRIGGERS PROCESSING) ---
  const handleApplyChanges = useCallback(async () => {
    if (!sessionId || slidersConfig.length === 0) return;

    setProcessing(true);
    try {
      console.log("🎛️ Applying changes and processing signal...");
      console.log("   Session ID:", sessionId);
      console.log("   Sliders config:", slidersConfig);

      // Run the heavy processing (FFT→Gain→IFFT) on the server
      const processResult = await processSignal(sessionId, slidersConfig);
      console.log("   ✅ Process signal completed:", processResult);

      // Immediately construct fresh cache-busted URLs (use exact timestamp)
      const ts = Date.now();
      const newInputUrl = `${API_BASE_URL}/audio/input?session_id=${sessionId}&t=${ts}`;
      const newOutputUrl = `${API_BASE_URL}/audio/output?session_id=${sessionId}&t=${ts}`;
      
      console.log("📢 Updated audio URLs:");
      console.log("   Input:", newInputUrl);
      console.log("   Output:", newOutputUrl);

      // Immediately update the actual audio element to avoid races
      try {
        if (audioRefOutput?.current) {
          audioRefOutput.current.pause();
          audioRefOutput.current.currentTime = 0;
          audioRefOutput.current.src = newOutputUrl;
          audioRefOutput.current.load();
        }
        if (audioRefInput?.current) {
          audioRefInput.current.src = newInputUrl;
          audioRefInput.current.load();
        }
      } catch (err) {
        console.warn("Could not update audio element DOM directly:", err);
      }

      // Also keep React state in sync (single source for other effects/UI)
      setAudioUrlInput(newInputUrl);
      setAudioUrlOutput(newOutputUrl);

      // Fetch spectrogram data (best-effort)
      try {
        const inputSpec = await axios.get(
          `${API_BASE_URL}/spectrogram/input?session_id=${sessionId}`
        );
        setInputSpectrogramData(inputSpec.data);
      } catch (err) {
        console.warn("Could not fetch input spectrogram:", err);
      }

      try {
        const outputSpec = await axios.get(
          `${API_BASE_URL}/spectrogram/output?session_id=${sessionId}`
        );
        setOutputSpectrogramData(outputSpec.data);
      } catch (err) {
        console.warn("Could not fetch output spectrogram:", err);
      }

      // Fetch updated waveform and FFT data for visuals
      await fetchData(sessionId, "output_only");

      // Try to autoplay the updated output after a short delay
      setTimeout(() => {
        if (audioRefOutput?.current) {
          audioRefOutput.current
            .play()
            .catch((playErr) => console.warn("Audio play prevented:", playErr));
        }
      }, 150);

      console.log("Applied changes — audio element set to:", newOutputUrl);
    } catch (err) {
      console.error("Error applying changes:", err);
      alert("Failed to apply changes. Check console for details.");
    } finally {
      setProcessing(false);
    }
  }, [sessionId, slidersConfig]);

  // Separate handlers for input/output view changes (pan/zoom)
  const handleInputViewChange = useCallback((newView) => {
    setInputViewWindow(newView);
  }, []);

  const handleOutputViewChange = useCallback((newView) => {
    setOutputViewWindow(newView);
  }, []);

  const handleMixedViewChange = useCallback((newView) => {
    setMixedViewWindow(newView);
  }, []);

  return (
    <div>
      {/* UI Mode Switcher - Top of everything */}
      <div
        style={{
          backgroundColor: "#0a0a0a",
          padding: "15px 20px",
          borderBottom: "2px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <h2 style={{ margin: 0, color: "#fff", fontSize: "1.1rem" }}>
            UI Mode:
          </h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setUiMode("customized")}
              style={{
                padding: "10px 20px",
                backgroundColor:
                  uiMode === "customized" ? "#4A90E2" : "#2a2a2a",
                color: "#fff",
                border:
                  uiMode === "customized"
                    ? "2px solid #4A90E2"
                    : "2px solid #555",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: uiMode === "customized" ? "bold" : "normal",
                transition: "all 0.2s",
              }}
            >
              🎵 Customized Mode
            </button>
            <button
              onClick={() => setUiMode("generic")}
              style={{
                padding: "10px 20px",
                backgroundColor: uiMode === "generic" ? "#00ff88" : "#2a2a2a",
                color: uiMode === "generic" ? "#000" : "#fff",
                border:
                  uiMode === "generic" ? "2px solid #00ff88" : "2px solid #555",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: uiMode === "generic" ? "bold" : "normal",
                transition: "all 0.2s",
              }}
            >
              🎛️ Generic Mode
            </button>
          </div>
        </div>
        <div style={{ color: "#999", fontSize: "0.85rem" }}>
          {uiMode === "customized"
            ? "(Music/Animals/Human + AI Separation)"
            : "(Custom Sliders + Chart.js)"}
        </div>
      </div>

      {/* Conditional Rendering based on UI Mode */}
      {uiMode === "customized" ? (
        <div style={styles.container}>
          <div style={styles.header}>
            <h1 className="text-2xl font-bold">Signal Equalizer</h1>

            {/* Mode Selector */}
            <select
              onChange={(e) => handleChangeMode(sessionId, e.target.value)}
              style={styles.select}
              value={currentMode}
            >
              <option value="music">Musical Instruments Mode</option>
              <option value="animals">Animals Mode</option>
              <option value="human">Human Mode</option>
            </select>

            {/* File Upload Input */}
            <input
              type="file"
              onChange={handleFileUpload}
              style={{ color: "white" }}
              accept=".wav"
              disabled={loading}
            />

            {loading && <span style={{ color: "#F5A623" }}>Loading...</span>}
            {processing && (
              <span style={{ color: "#4A90E2" }}>Processing...</span>
            )}

            {sessionId && (
              <span style={styles.sessionIdText}>
                Session ID: {sessionId.substring(0, 8)}...
              </span>
            )}
          </div>

          {/* SLIDERS */}
          <h3
            style={{
              marginTop: "30px",
              borderBottom: "1px solid #333",
              paddingBottom: "10px",
            }}
          >
            Equalizer Sliders ({currentMode.toUpperCase()} Mode)
          </h3>

          {/* Instructions */}
          {sessionId && (
            <div
              style={{
                backgroundColor: "#1a1a1a",
                padding: "15px 20px",
                marginBottom: "15px",
                borderRadius: "8px",
                border: "1px solid #333",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#aaa",
                  fontSize: "0.9rem",
                  lineHeight: "1.6",
                }}
              >
                💡 <strong style={{ color: "#fff" }}>How to use:</strong>
                <br />
                <br />
                {currentMode === "music" && demucsStemUrls ? (
                  <>
                    <strong style={{ color: "#00ffff" }}>
                      🎛️ AI Stem Mixing Mode (Active):
                    </strong>
                    <br />• Sliders control <strong>stem volumes</strong> (Drums, Bass, Vocals, Piano)
                    <br />• <strong>1.0x = Normal volume</strong>, 0.0x = Muted, 2.0x = Double volume
                    <br />• Adjust sliders, then click <strong>"Mix Stems"</strong> below the separated stems
                    <br />• You'll get a <strong>mixed output</strong> with all stems combined
                    <br />
                    <br />
                    <strong style={{ color: "#00ff88" }}>
                      ⚡ Regular EQ Mode (Also Available):
                    </strong>
                    <br />• Use <strong>"Apply Changes"</strong> button for frequency-domain EQ
                    <br />
                  </>
                ) : (
                  <>
                    <strong style={{ color: "#00ff88" }}>
                      Linear Gain System:
                    </strong>
                    <br />• <strong>Move sliders</strong> to adjust frequency bands
                    <br />• <strong>1.0x = No change</strong> to the audio
                    <br />• <strong>0.0x = Mute</strong> that frequency band completely
                    <br />• <strong>2.0x = Double</strong> the amplitude (≈ +6 dB)
                    <br />• <strong>0.5x = Half</strong> the amplitude (≈ -6 dB)
                    <br />• <strong>Click "Apply Changes"</strong> to process the signal
                    <br />
                    {currentMode === "music" && (
                      <>
                        <br />
                        <strong style={{ color: "#00ffff" }}>
                          🎵 Music Mode Tip:
                        </strong>
                        <br />• Run <strong>"Separate with AI"</strong> below to enable stem mixing!
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
          )}

          <div style={styles.sliderContainer}>
            <EqualizerSliders
              labels={labels}
              onChange={handleSliderChange}
              disabled={!sessionId}
            />
          </div>

          {/* ACTION BUTTONS */}
          {sessionId && (
            <div
              style={{
                marginTop: "25px",
                display: "flex",
                gap: "15px",
                justifyContent: "center",
                flexWrap: "wrap",
                padding: "20px",
                backgroundColor: "#1a1a1a",
                borderRadius: "8px",
                border: "1px solid #333",
              }}
            >
              <button
                onClick={handleApplyChanges}
                disabled={processing}
                style={{
                  padding: "15px 50px",
                  fontSize: "1.15rem",
                  fontWeight: "bold",
                  backgroundColor: processing ? "#555" : "#2ecc71",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: processing ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 16px rgba(46, 204, 113, 0.5)",
                  transition: "all 0.3s ease",
                  opacity: processing ? 0.6 : 1,
                  transform: processing ? "scale(0.98)" : "scale(1)",
                }}
                onMouseEnter={(e) => {
                  if (!processing) {
                    e.target.style.transform = "scale(1.05)";
                    e.target.style.boxShadow =
                      "0 6px 20px rgba(46, 204, 113, 0.7)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!processing) {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow =
                      "0 4px 16px rgba(46, 204, 113, 0.5)";
                  }
                }}
              >
                {processing ? "⏳ Processing..." : "✅ Apply Changes & Process"}
              </button>
            </div>
          )}

          {/* EQUALIZED AUDIO PLAYER - Plays the result of slider adjustments */}
          {sessionId && (
            <div
              style={{
                marginTop: "30px",
                padding: "25px",
                background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
                borderRadius: "12px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
                border: "2px solid #4A90E2",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                  marginBottom: "15px",
                }}
              >
                <span style={{ fontSize: "24px" }}>🎧</span>
                <div>
                  <h3 style={{ margin: 0, color: "#fff", fontSize: "1.2rem" }}>
                    Equalized Audio Output
                  </h3>
                  <p
                    style={{
                      margin: "5px 0 0 0",
                      fontSize: "0.85rem",
                      color: "#b3d9ff",
                    }}
                  >
                    Listen to your processed signal with the current slider
                    settings
                  </p>
                </div>
              </div>
              <audio
                ref={audioRefOutput}
                key={audioUrlOutput}
                src={audioUrlOutput}
                controls
                style={{
                  width: "100%",
                  outline: "none",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                }}
                preload="auto"
              />
            </div>
          )}

          {/* INPUT SIGNAL GRAPHS */}
          <h3
            style={{
              marginTop: "30px",
              borderBottom: "1px solid #333",
              paddingBottom: "10px",
            }}
          >
            Input Signal (Original)
          </h3>
          <div style={styles.grid}>
            <div style={styles.card}>
              <h3>Time Domain (Input)</h3>
              <CinePlayer
                data={inputWaveform}
                audioSrc={audioUrlInput}
                type="input"
                viewWindow={inputViewWindow}
                onViewChange={handleInputViewChange}
                audioRef={audioRefInput} // Pass input audio ref (though controls are hidden)
              />
            </div>

            <div style={styles.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <h3>Frequency Domain (Input)</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setFrequencyScale("linear")}
                    style={{
                      padding: "6px 12px",
                      backgroundColor:
                        frequencyScale === "linear"
                          ? "rgb(34, 197, 94)"
                          : "#333",
                      color: frequencyScale === "linear" ? "#fff" : "#999",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Linear
                  </button>
                  <button
                    onClick={() => setFrequencyScale("audiogram")}
                    style={{
                      padding: "6px 12px",
                      backgroundColor:
                        frequencyScale === "audiogram"
                          ? "rgb(34, 197, 94)"
                          : "#333",
                      color: frequencyScale === "audiogram" ? "#fff" : "#999",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Audiogram
                  </button>
                </div>
              </div>
              <FrequencyGraph
                fftData={
                  inputFftData
                    ? {
                        frequencies: inputFftData.map(
                          (_, i) => (i * 22050) / inputFftData.length
                        ),
                        magnitudes: inputFftData,
                      }
                    : null
                }
                scale={frequencyScale}
                title="Input Frequency Spectrum"
                maxFrequency={22050}
                height={300}
              />
            </div>

            <div style={styles.card}>
              <h3>Spectrogram (Input)</h3>
              <Spectrogram
                spectrogramData={inputSpectrogramData}
                title="Input Signal Spectrogram"
                height={300}
                maxFreq={5000}
              />
            </div>
          </div>

          {/* OUTPUT SIGNAL GRAPHS */}
          <h3
            style={{
              marginTop: "30px",
              borderBottom: "1px solid #333",
              paddingBottom: "10px",
            }}
          >
            Output Signal (Equalized)
          </h3>
          <div style={styles.grid}>
            <div style={styles.card}>
              <h3>Time Domain (Output)</h3>
              {/* The Output CinePlayer uses the audioRefOutput to track playback time for the linked visualization */}
              <CinePlayer
                data={outputWaveform}
                audioSrc={audioUrlOutput}
                type="output"
                viewWindow={outputViewWindow}
                onViewChange={handleOutputViewChange}
                audioRef={audioRefOutput} // Pass output audio ref
              />
            </div>

            <div style={styles.card}>
              <h3>Frequency Domain (Output)</h3>
              <div
                style={{ display: "flex", gap: "8px", marginBottom: "10px" }}
              >
                <button
                  onClick={() => setFrequencyScale("linear")}
                  style={{
                    padding: "6px 12px",
                    backgroundColor:
                      frequencyScale === "linear" ? "rgb(34, 197, 94)" : "#333",
                    color: frequencyScale === "linear" ? "#fff" : "#999",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Linear
                </button>
                <button
                  onClick={() => setFrequencyScale("audiogram")}
                  style={{
                    padding: "6px 12px",
                    backgroundColor:
                      frequencyScale === "audiogram"
                        ? "rgb(34, 197, 94)"
                        : "#333",
                    color: frequencyScale === "audiogram" ? "#fff" : "#999",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Audiogram
                </button>
              </div>
              <FrequencyGraph
                fftData={
                  outputFftData
                    ? {
                        frequencies: outputFftData.map(
                          (_, i) => (i * 22050) / outputFftData.length
                        ),
                        magnitudes: outputFftData,
                      }
                    : null
                }
                scale={frequencyScale}
                title="Output Frequency Spectrum"
                maxFrequency={22050}
                height={300}
              />
            </div>

            <div style={styles.card}>
              <h3>Spectrogram (Output)</h3>
              <Spectrogram
                spectrogramData={outputSpectrogramData}
                title="Output Signal Spectrogram"
                height={300}
                maxFreq={5000}
              />
            </div>
          </div>

          {/* DEMUCS AI SEPARATION SECTION */}
          {currentMode === "music" && (
            <>
              <h3
                style={{
                  marginTop: "50px",
                  borderBottom: "2px solid #00ff88",
                  paddingBottom: "10px",
                  color: "#00ff88",
                }}
              >
                🎵 AI Source Separation (Demucs)
              </h3>
              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  backgroundColor: "#1a1a1a",
                  borderRadius: "8px",
                }}
              >
                <p style={{ marginBottom: "15px", color: "#ccc" }}>
                  Separate your audio into individual instruments using
                  state-of-the-art AI (Meta's Demucs model). This will extract:{" "}
                  <strong>Drums</strong>, <strong>Bass</strong>,{" "}
                  <strong>Vocals</strong>, and <strong>Other</strong> (piano,
                  guitar, etc).
                </p>

                <button
                  onClick={handleDemucsSeparation}
                  disabled={!sessionId || demucsProcessing}
                  style={{
                    padding: "12px 30px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    backgroundColor: demucsProcessing ? "#555" : "#00ff88",
                    color: "#000",
                    border: "none",
                    borderRadius: "5px",
                    cursor:
                      !sessionId || demucsProcessing
                        ? "not-allowed"
                        : "pointer",
                    transition: "all 0.3s ease",
                    opacity: !sessionId || demucsProcessing ? 0.5 : 1,
                  }}
                >
                  {demucsProcessing
                    ? "🔄 Separating Audio... (This may take 30-60 seconds)"
                    : "🚀 Separate with AI (Demucs)"}
                </button>

                {demucsError && (
                  <div
                    style={{
                      marginTop: "15px",
                      padding: "15px",
                      backgroundColor: "#ff4444",
                      borderRadius: "5px",
                      color: "#fff",
                    }}
                  >
                    <strong>Error:</strong> {demucsError}
                  </div>
                )}

                {demucsStemUrls && (
                  <div style={{ marginTop: "30px" }}>
                    <h4 style={{ marginBottom: "20px", color: "#00ff88" }}>
                      ✅ Separated Stems (Click to play):
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(250px, 1fr))",
                        gap: "20px",
                      }}
                    >
                      {Object.entries(demucsStemUrls).map(
                        ([stemName, stemUrl]) => (
                          <div
                            key={stemName}
                            style={{
                              padding: "15px",
                              backgroundColor: "#2a2a2a",
                              borderRadius: "8px",
                              border: "1px solid #444",
                            }}
                          >
                            <h5
                              style={{
                                marginBottom: "10px",
                                textTransform: "capitalize",
                                color: "#00ff88",
                                fontSize: "18px",
                              }}
                            >
                              {stemName === "other"
                                ? "🎹 Other (Piano/Guitar)"
                                : stemName === "drums"
                                ? "🥁 Drums"
                                : stemName === "bass"
                                ? "🎸 Bass"
                                : "🎤 Vocals"}
                            </h5>
                            <audio
                              controls
                              src={`${API_BASE_URL}${stemUrl}`}
                              style={{ width: "100%", marginTop: "10px" }}
                              preload="none"
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* MIXING SECTION - Only show after AI separation completes */}
                {demucsStemUrls && (
                  <div style={{ marginTop: "40px" }}>
                    <h4
                      style={{
                        marginBottom: "20px",
                        color: "#00ffff",
                        borderBottom: "2px solid #00ffff",
                        paddingBottom: "10px",
                      }}
                    >
                      🎛️ Mix Separated Stems with Slider Controls
                    </h4>

                    <p style={{ marginBottom: "15px", color: "#ccc" }}>
                      Use the sliders above to control each stem's volume, then
                      click the button below to mix them into a single output:
                    </p>

                    {/* Display current gains */}
                    <div
                      style={{
                        padding: "15px",
                        backgroundColor: "#2a2a2a",
                        borderRadius: "8px",
                        marginBottom: "20px",
                      }}
                    >
                      <strong style={{ color: "#00ffff" }}>
                        Current gains (dB → Linear Multiplier):
                      </strong>
                      <div
                        style={{
                          marginTop: "10px",
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: "10px",
                        }}
                      >
                        {slidersConfig.map((slider, idx) => {
                          const dB = slider.gain;
                          const linearGain = Math.pow(10, dB / 20);
                          return (
                            <div key={idx}>
                              <span style={{ color: "#00ff88" }}>
                                {labels[idx]}:
                              </span>{" "}
                              <span style={{ color: "#fff", fontWeight: "bold" }}>
                                {dB.toFixed(1)} dB → {linearGain.toFixed(2)}x
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mix button */}
                    <button
                      onClick={handleMixDemucsStems}
                      disabled={!sessionId || mixingDemucsStems}
                      style={{
                        padding: "15px 30px",
                        fontSize: "18px",
                        backgroundColor: mixingDemucsStems
                          ? "#666"
                          : "#00ffff",
                        color: "#000",
                        border: "none",
                        borderRadius: "8px",
                        cursor:
                          !sessionId || mixingDemucsStems
                            ? "not-allowed"
                            : "pointer",
                        fontWeight: "bold",
                        transition: "all 0.3s ease",
                        opacity: !sessionId || mixingDemucsStems ? 0.5 : 1,
                      }}
                    >
                      {mixingDemucsStems
                        ? "🔄 Mixing..."
                        : "🎚️ Mix Stems with Current Slider Settings"}
                    </button>

                    {/* Error display */}
                    {demucsMixError && (
                      <div
                        style={{
                          marginTop: "15px",
                          padding: "15px",
                          backgroundColor: "#ff4444",
                          borderRadius: "5px",
                          color: "#fff",
                        }}
                      >
                        <strong>Error:</strong> {demucsMixError}
                      </div>
                    )}

                    {/* Mixed output display */}
                    {demucsMixedData && (
                      <div style={{ marginTop: "30px" }}>
                        <h4
                          style={{
                            marginBottom: "20px",
                            color: "#00ff88",
                          }}
                        >
                          ✅ Mixed Output (All Stems Combined)
                        </h4>

                        {/* Audio player */}
                        <div
                          style={{
                            padding: "20px",
                            backgroundColor: "#2a2a2a",
                            borderRadius: "8px",
                            marginBottom: "20px",
                          }}
                        >
                          <h5 style={{ marginBottom: "10px", color: "#fff" }}>
                            🎧 Mixed Audio:
                          </h5>
                          <audio
                            ref={audioRefMixed}
                            controls
                            src={`${API_BASE_URL}${demucsMixedData.mixed_audio_url}`}
                            style={{ width: "100%" }}
                          />
                        </div>

                        {/* Visualizations */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: "20px",
                          }}
                        >
                          {/* Time Domain */}
                          <div
                            style={{
                              padding: "20px",
                              backgroundColor: "#2a2a2a",
                              borderRadius: "8px",
                            }}
                          >
                            <h5 style={{ marginBottom: "15px", color: "#fff" }}>
                              📊 Time Domain (Waveform)
                            </h5>
                            <CinePlayer
                              data={demucsMixedData.waveform.data}
                              audioRef={audioRefMixed}
                              type="mixed"
                              viewWindow={mixedViewWindow}
                              onViewChange={handleMixedViewChange}
                            />
                          </div>

                          {/* Frequency Domain */}
                          <div
                            style={{
                              padding: "20px",
                              backgroundColor: "#2a2a2a",
                              borderRadius: "8px",
                            }}
                          >
                            <h5 style={{ marginBottom: "15px", color: "#fff" }}>
                              📈 Frequency Domain (FFT)
                            </h5>
                            <FrequencyGraph
                              frequencies={demucsMixedData.fft.frequencies}
                              magnitudes={demucsMixedData.fft.magnitudes}
                              title="Mixed FFT"
                            />
                          </div>

                          {/* Spectrogram */}
                          <div
                            style={{
                              padding: "20px",
                              backgroundColor: "#2a2a2a",
                              borderRadius: "8px",
                            }}
                          >
                            <h5 style={{ marginBottom: "15px", color: "#fff" }}>
                              🎨 Spectrogram (STFT)
                            </h5>
                            <Spectrogram data={demucsMixedData.spectrogram} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* HUMAN VOICE SEPARATION SECTION */}
          {currentMode === "human" && (
            <>
              <h3
                style={{
                  marginTop: "50px",
                  borderBottom: "2px solid #ff6b6b",
                  paddingBottom: "10px",
                  color: "#ff6b6b",
                }}
              >
                🎤 AI Voice Separation (MultiDecoderDPRNN)
              </h3>
              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  backgroundColor: "#1a1a1a",
                  borderRadius: "8px",
                }}
              >
                <p style={{ marginBottom: "15px", color: "#ccc" }}>
                  Separate mixed human voices into individual speakers using AI
                  (Asteroid's MultiDecoderDPRNN model). This will automatically
                  detect and extract individual speakers from the audio.
                </p>

                <button
                  onClick={() => handleHumanSeparation(2, 4)}
                  disabled={!sessionId || humanProcessing}
                  style={{
                    padding: "12px 30px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    backgroundColor: humanProcessing ? "#555" : "#ff6b6b",
                    color: "#fff",
                    border: "none",
                    borderRadius: "5px",
                    cursor:
                      !sessionId || humanProcessing ? "not-allowed" : "pointer",
                    transition: "all 0.3s ease",
                    opacity: !sessionId || humanProcessing ? 0.5 : 1,
                  }}
                >
                  {humanProcessing
                    ? "🔄 Separating Voices... (This may take 30-90 seconds)"
                    : "🚀 Separate Speakers with AI"}
                </button>

                {humanError && (
                  <div
                    style={{
                      marginTop: "15px",
                      padding: "15px",
                      backgroundColor: "#ff4444",
                      borderRadius: "5px",
                      color: "#fff",
                    }}
                  >
                    <strong>Error:</strong> {humanError}
                  </div>
                )}

                {humanSourceUrls && (
                  <div style={{ marginTop: "30px" }}>
                    <h4 style={{ marginBottom: "20px", color: "#ff6b6b" }}>
                      ✅ Separated Speakers (Found {numSpeakers} speaker
                      {numSpeakers !== 1 ? "s" : ""}):
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(250px, 1fr))",
                        gap: "20px",
                      }}
                    >
                      {Object.entries(humanSourceUrls).map(
                        ([sourceName, sourceUrl]) => {
                          const speakerNum = sourceName.replace("speaker_", "");
                          return (
                            <div
                              key={sourceName}
                              style={{
                                padding: "15px",
                                backgroundColor: "#2a2a2a",
                                borderRadius: "8px",
                                border: "1px solid #ff6b6b",
                              }}
                            >
                              <h5
                                style={{
                                  marginBottom: "10px",
                                  textTransform: "capitalize",
                                  color: "#ff6b6b",
                                  fontSize: "18px",
                                }}
                              >
                                🗣️ Speaker {speakerNum}
                              </h5>
                              <audio
                                controls
                                src={`${API_BASE_URL}${sourceUrl}`}
                                style={{ width: "100%", marginTop: "10px" }}
                                preload="none"
                              />
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Hidden Input Audio Element (for consistency, uses same session ID) */}
          <audio
            ref={audioRefInput}
            key={audioUrlInput}
            src={audioUrlInput}
            preload="none"
            style={{ display: "none" }}
          />
        </div>
      ) : (
        <GenericMode />
      )}
    </div>
  );
}
