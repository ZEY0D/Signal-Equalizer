// // src/contexts/AudioContext.jsx
// import React, {
//   createContext,
//   useContext,
//   useState,
//   useRef,
//   useEffect,
// } from "react";
// import { createSyntheticAudioBuffer } from "../utils/syntheticSignal";
// import _ from "lodash";
// // Create the AudioContext for React
// const AudioContext = createContext();

// // Custom hook to access the AudioContext
// export const useAudio = () => {
//   const context = useContext(AudioContext);
//   if (!context) {
//     throw new Error("useAudio must be used within an AudioProvider");
//   }
//   return context;
// };

// // AudioProvider component that wraps the app
// export const AudioProvider = ({ children }) => {
//   // --- Audio buffers ---
//   const [inputSignal, setInputSignal] = useState(null); // Original audio buffer
//   const [outputSignal, setOutputSignal] = useState(null); // Processed audio buffer

//   // --- Visualization ---
//   const [frequencyData, setFrequencyData] = useState(null); // FFT data for visualizers

//   // --- Playback state ---
//   const [isPlaying, setIsPlaying] = useState(false); // Whether audio is currently playing
//   const [currentTime, setCurrentTime] = useState(0); // Current playback time

//   // --- State management for sliders and modes ---
//   const [sliders, setSliders] = useState([]); // Array of EQ sliders
//   const [currentMode, setCurrentMode] = useState("generic"); // Current EQ mode
//   const [isProcessing, setIsProcessing] = useState(false); // Flag for processing state

//   // --- Refs ---
//   const audioContextRef = useRef(null); // Web Audio API AudioContext
//   const analyserRef = useRef(null); // AnalyserNode for FFT visualization
//   const sourceRef = useRef(null); // AudioBufferSourceNode for playback
//   const startTimeRef = useRef(0); // Reference to playback start time
//   const animationFrameRef = useRef(null); // For requestAnimationFrame updates

//   // --- Initialize AudioContext and load default synthetic signal ---
//   useEffect(() => {
//     initializeAudio();
//     loadSyntheticSignal();
//     addDefaultSliders(); // Load default sliders on start
//   }, []);

//   // --- Add default EQ sliders ---
//   const addDefaultSliders = () => {
//     const defaultSliders = [
//       { id: 1, centerFreq: 100, width: 150, gain: 1.0, label: "Bass" },
//       { id: 2, centerFreq: 1000, width: 800, gain: 1.0, label: "Mid" },
//       { id: 3, centerFreq: 5000, width: 3000, gain: 1.0, label: "Treble" },
//     ];
//     setSliders(defaultSliders);
//   };

//   // --- Initialize the AudioContext and analyser ---
//   const initializeAudio = () => {
//     // Create a new Web Audio API AudioContext
//     // Supports older browsers with webkit prefix
//     const audioContext = new (window.AudioContext ||
//       window.webkitAudioContext)();
//     audioContextRef.current = audioContext; // Save reference for later use

//     // Create an AnalyserNode to extract frequency data (for visualization)
//     const analyser = audioContext.createAnalyser();
//     analyser.fftSize = 2048; // Determines frequency resolution (number of bins)
//     analyserRef.current = analyser;

//     // Function to continuously update frequency data for visualizers
//     const updateFrequencyData = () => {
//       if (analyserRef.current) {
//         // Create an array to hold frequency data
//         const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
//         // Fill array with current frequency amplitude data (0-255)
//         analyserRef.current.getByteFrequencyData(dataArray);
//         // Update React state so visualizers can render
//         setFrequencyData(dataArray);
//       }
//       // Loop using requestAnimationFrame for smooth, continuous updates
//       animationFrameRef.current = requestAnimationFrame(updateFrequencyData);
//     };

//     updateFrequencyData(); // Start updating frequency data
//   };

//   // --- Load a synthetic audio signal ---
//   const loadSyntheticSignal = async () => {
//     if (!audioContextRef.current) return; // Ensure AudioContext exists

//     try {
//       console.log("🎵 Loading synthetic test signal...");
//       // Generate a synthetic audio buffer (e.g., sine wave, test tones)
//       const audioBuffer = await createSyntheticAudioBuffer(
//         audioContextRef.current
//       );
//       setInputSignal(audioBuffer); // Save original buffer
//       setOutputSignal(audioBuffer); // Initialize output buffer (before EQ)
//       console.log("✅ Synthetic signal loaded successfully");
//     } catch (error) {
//       console.error("❌ Error loading synthetic signal:", error);
//     }
//   };

//   // --- Load audio file from user input ---
//   const loadAudioFile = async (file) => {
//     if (!audioContextRef.current) return;
//     try {
//       const arrayBuffer = await file.arrayBuffer();
//       const audioBuffer = await audioContextRef.current.decodeAudioData(
//         arrayBuffer
//       );
//       setInputSignal(audioBuffer);
//       setOutputSignal(audioBuffer);
//     } catch (error) {
//       console.error("❌ Error loading audio file:", error);
//     }
//   };

//   // --- Generate gain array for each frequency bin based on sliders ---
//   const generateGainArray = (sliders, frequencyBins) => {
//     // Initialize gains array: default gain = 1 (no change)
//     const gains = new Array(frequencyBins.length).fill(1.0);

//     // Loop through each slider (EQ band)
//     sliders.forEach((slider) => {
//       const { centerFreq, width, gain } = slider; // Extract properties
//       const halfWidth = width / 2; // Half width defines edges around center frequency

//       // Loop through each frequency bin
//       for (let i = 0; i < frequencyBins.length; i++) {
//         const freq = frequencyBins[i];
//         const distance = Math.abs(freq - centerFreq); // Distance from slider center

//         // Apply effect only if within slider range
//         if (distance <= halfWidth) {
//           const norm = distance / halfWidth; // Normalize distance (0 → 1)
//           const smooth = Math.cos((norm * Math.PI) / 2); // Cosine window → smooth edges
//           const smoothGain = 1 + (gain - 1) * smooth; // Interpolate gain: 1 → desired gain
//           gains[i] *= smoothGain; // Multiply in case of overlapping sliders
//         }
//       }
//     });

//     return gains; // Return final array of gains for all frequency bins
//   };

//   // --- Calculate frequency bins for the analyser ---
//   const getFrequencyBins = () => {
//     if (!analyserRef.current) return [];
//     const binCount = analyserRef.current.frequencyBinCount;
//     const sampleRate = audioContextRef.current?.sampleRate || 44100;
//     const frequencies = [];
//     for (let i = 0; i < binCount; i++) {
//       frequencies.push((i * (sampleRate / 2)) / binCount);
//     }
//     return frequencies;
//   };
//   // Debounced version to avoid too many updates while sliding

//   // --- Apply equalizer to the audio signal ---
//   const applyEqualizer = async (bands) => {
//     if (!inputSignal || !audioContextRef.current) return;

//     try {
//       setIsProcessing(true);
//       setSliders(bands);

//       const frequencyBins = getFrequencyBins();
//       const gainArray = generateGainArray(bands, frequencyBins);

//       const processedBuffer = await processWithBackend(
//         inputSignal,
//         bands,
//         gainArray
//       );
//       setOutputSignal(processedBuffer);

//       sendToSignalViewer(processedBuffer, bands);
//       logEqualizerEffects(bands, inputSignal.metadata);
//     } catch (error) {
//       console.error("❌ Error applying equalizer:", error);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   const debouncedApply = useRef(_.debounce(applyEqualizer, 200)).current;

//   // --- Send data to backend for real processing ---
//   const processWithBackend = async (audioBuffer, bands, gainArray) => {
//     try {
//       const audioData = audioBuffer.getChannelData(0);
//       const requestData = {
//         audioData: Array.from(audioData),
//         gainArray,
//         sampleRate: audioBuffer.sampleRate,
//         bands,
//         mode: currentMode,
//       };

//       const response = await fetch("http://localhost:8000/api/process-audio", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(requestData),
//       });

//       if (!response.ok) throw new Error(Backend error: ${response.status});

//       const result = await response.json();

//       // Convert processed array back to AudioBuffer
//       const processedBuffer = audioContextRef.current.createBuffer(
//         1,
//         result.processedAudio.length,
//         audioBuffer.sampleRate
//       );
//       processedBuffer.getChannelData(0).set(result.processedAudio);

//       return processedBuffer;
//     } catch (error) {
//       // Fallback if backend fails
//       return applySimpleProcessing(audioBuffer, gainArray);
//     }
//   };

//   // --- Simple frontend fallback processing ---
//   const applySimpleProcessing = (audioBuffer, gainArray) => {
//     const clonedBuffer = audioContextRef.current.createBuffer(
//       audioBuffer.numberOfChannels,
//       audioBuffer.length,
//       audioBuffer.sampleRate
//     );
//     for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
//       clonedBuffer
//         .getChannelData(channel)
//         .set(audioBuffer.getChannelData(channel));
//     }
//     return clonedBuffer;
//   };

//   // --- Dispatch event to update external signal viewer ---
//   const sendToSignalViewer = (processedBuffer, bands) => {
//     const event = new CustomEvent("equalizerUpdated", {
//       detail: {
//         processedBuffer,
//         bands,
//         mode: currentMode,
//         timestamp: Date.now(),
//       },
//     });
//     window.dispatchEvent(event);
//   };

//   // --- Slider management ---
//   const addSlider = (sliderData = {}) => {
//     const newSlider = {
//       id: Date.now(),
//       centerFreq: sliderData.centerFreq || 1000,
//       width: sliderData.width || 500,
//       gain: sliderData.gain || 1.0,
//       label: sliderData.label || Band ${sliders.length + 1},
//       ...sliderData,
//     };
//     const updatedSliders = [...sliders, newSlider];
//     setSliders(updatedSliders);
//     debouncedApply(updatedSliders);

//     return newSlider;
//   };

//   const updateSlider = (sliderId, updates) => {
//     const updatedSliders = sliders.map((slider) =>
//       slider.id === sliderId ? { ...slider, ...updates } : slider
//     );
//     setSliders(updatedSliders);
//     debouncedApply(updatedSliders);
//   };

//   const removeSlider = (sliderId) => {
//     const updatedSliders = sliders.filter((slider) => slider.id !== sliderId);
//     setSliders(updatedSliders);
//     debouncedApply(updatedSliders);
//   };

//   // --- Mode management ---
//   const changeMode = (newMode) => {
//     setCurrentMode(newMode);
//     loadModeSettings(newMode);
//   };

//   const loadModeSettings = (mode) => {
//     // TODO: Load mode settings from file or server
//   };

//   // --- Log equalizer effects for debugging ---
//   const logEqualizerEffects = (bands, metadata) => {
//     if (!metadata?.frequencies) return;

//     metadata.frequencies.forEach((freq) => {
//       const affectingBands = bands.filter((band) => {
//         const startFreq = band.centerFreq - band.width / 2;
//         const endFreq = band.centerFreq + band.width / 2;
//         return freq >= startFreq && freq <= endFreq;
//       });

//       if (affectingBands.length > 0) {
//         const totalGain = affectingBands.reduce(
//           (acc, band) => acc * band.gain,
//           1
//         );
//         console.log(
//           `${freq}Hz: ${
//             affectingBands.length
//           } band(s) → Gain: ${totalGain.toFixed(2)}x`
//         );
//       }
//     });
//   };

//   // --- Playback controls ---
//   const playAudio = (type = "output") => {
//     const buffer = type === "input" ? inputSignal : outputSignal;
//     if (!buffer || !audioContextRef.current) return;

//     if (sourceRef.current) sourceRef.current.stop();

//     const source = audioContextRef.current.createBufferSource();
//     source.buffer = buffer;
//     if (analyserRef.current) source.connect(analyserRef.current);
//     source.connect(audioContextRef.current.destination);

//     const startTime = audioContextRef.current.currentTime;
//     source.start();

//     sourceRef.current = source;
//     startTimeRef.current = startTime;
//     setIsPlaying(true);

//     const updateTime = () => {
//       if (!sourceRef.current) return;
//       const elapsed =
//         audioContextRef.current.currentTime - startTimeRef.current;
//       if (elapsed >= buffer.duration) {
//         setCurrentTime(buffer.duration);
//         setIsPlaying(false);
//         sourceRef.current = null;
//         return;
//       }
//       setCurrentTime(elapsed);
//       animationFrameRef.current = requestAnimationFrame(updateTime);
//     };

//     animationFrameRef.current = requestAnimationFrame(updateTime);

//     source.onended = () => {
//       setIsPlaying(false);
//       setCurrentTime(buffer.duration);
//       sourceRef.current = null;
//       if (animationFrameRef.current)
//         cancelAnimationFrame(animationFrameRef.current);
//     };
//   };

//   const stopAudio = () => {
//     if (sourceRef.current) sourceRef.current.stop();
//     if (animationFrameRef.current)
//       cancelAnimationFrame(animationFrameRef.current);
//     setIsPlaying(false);
//     setCurrentTime(0);
//   };

//   // --- Context value ---
//   const value = {
//     inputSignal,
//     outputSignal,
//     frequencyData,
//     isPlaying,
//     currentTime,
//     sliders,
//     currentMode,
//     isProcessing,
//     loadAudioFile,
//     loadSyntheticSignal,
//     applyEqualizer,
//     playAudio,
//     stopAudio,
//     addSlider,
//     updateSlider,
//     removeSlider,
//     changeMode,
//     generateGainArray,
//     getFrequencyBins,
//   };

//   return (
//     <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
//   );
// };
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from "react";
import { createSyntheticAudioBuffer } from "../utils/syntheticSignal";
import _ from "lodash";

const AudioContext = createContext();

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context)
    throw new Error("useAudio must be used within an AudioProvider");
  return context;
};

export const AudioProvider = ({ children }) => {
  const [inputSignal, setInputSignal] = useState(null);
  const [outputSignal, setOutputSignal] = useState(null);
  const [frequencyData, setFrequencyData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [sliders, setSliders] = useState([]);
  const [currentMode, setCurrentMode] = useState("generic");
  const [isProcessing, setIsProcessing] = useState(false);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const startTimeRef = useRef(0);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    initializeAudio();
    loadSyntheticSignal();
    addDefaultSliders();
  }, []);

  const addDefaultSliders = () => {
    const defaultSliders = [
      { id: 1, centerFreq: 100, width: 150, gain: 1.0, label: "Bass" },
      { id: 2, centerFreq: 1000, width: 800, gain: 1.0, label: "Mid" },
      { id: 3, centerFreq: 5000, width: 3000, gain: 1.0, label: "Treble" },
    ];
    setSliders(defaultSliders);
  };

  const initializeAudio = () => {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    const updateFrequencyData = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setFrequencyData(dataArray);
      }
      animationFrameRef.current = requestAnimationFrame(updateFrequencyData);
    };

    updateFrequencyData();
  };

  const loadSyntheticSignal = async () => {
    if (!audioContextRef.current) return;
    try {
      const audioBuffer = await createSyntheticAudioBuffer(
        audioContextRef.current
      );
      setInputSignal(audioBuffer);
      setOutputSignal(audioBuffer);
    } catch (error) {
      console.error("Error loading synthetic signal:", error);
    }
  };

  const loadAudioFile = async (file) => {
    if (!audioContextRef.current) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(
        arrayBuffer
      );
      setInputSignal(audioBuffer);
      setOutputSignal(audioBuffer);
    } catch (error) {
      console.error("Error loading audio file:", error);
    }
  };

  const getFrequencyBins = () => {
    if (!analyserRef.current) return [];
    const binCount = analyserRef.current.frequencyBinCount;
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const frequencies = [];
    for (let i = 0; i < binCount; i++) {
      frequencies.push((i * (sampleRate / 2)) / binCount);
    }
    return frequencies;
  };

  const generateGainArray = (sliders, frequencyBins) => {
    const gains = new Array(frequencyBins.length).fill(1.0);

    sliders.forEach((slider) => {
      const { centerFreq, width, gain } = slider;
      const halfWidth = width / 2;

      for (let i = 0; i < frequencyBins.length; i++) {
        const freq = frequencyBins[i];
        const distance = Math.abs(freq - centerFreq);

        if (distance <= halfWidth) {
          const norm = distance / halfWidth;
          const smooth = Math.cos((norm * Math.PI) / 2);
          const smoothGain = 1 + (gain - 1) * smooth;
          gains[i] *= smoothGain; // تراكم الباندات
        }
      }
    });

    return gains;
  };

  const applyEqualizer = async (bands) => {
    if (!inputSignal || !audioContextRef.current) return;

    setIsProcessing(true);
    setSliders(bands);

    try {
      const frequencyBins = getFrequencyBins();
      const gainArray = generateGainArray(bands, frequencyBins);
      const processedBuffer = await processWithBackend(
        inputSignal,
        bands,
        gainArray
      );

      setOutputSignal(processedBuffer);
      sendToSignalViewer(processedBuffer, bands);
      logEqualizerEffects(bands, inputSignal.metadata);
    } catch (error) {
      console.error("Error applying equalizer:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const processWithBackend = async (audioBuffer, bands, gainArray) => {
    try {
      const requestData = {
        audioData: Array.from(audioBuffer.getChannelData(0)),
        gainArray,
        sampleRate: audioBuffer.sampleRate,
        bands,
        mode: currentMode,
      };
      const response = await fetch("http://localhost:8000/api/process-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) throw new Error(`Backend error: ${response.status}`);

      const result = await response.json();
      const processedBuffer = audioContextRef.current.createBuffer(
        1,
        result.processedAudio.length,
        audioBuffer.sampleRate
      );
      processedBuffer.getChannelData(0).set(result.processedAudio);
      return processedBuffer;
    } catch (error) {
      return applySimpleProcessing(audioBuffer, gainArray);
    }
  };

  const applySimpleProcessing = (audioBuffer, gainArray) => {
    const clonedBuffer = audioContextRef.current.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const inputData = audioBuffer.getChannelData(ch);
      const outputData = clonedBuffer.getChannelData(ch);

      for (let i = 0; i < audioBuffer.length; i++) {
        // تطبق gains على طول الإشارة (باندات متراكبة)
        outputData[i] = inputData[i] * gainArray[i];
      }
    }

    return clonedBuffer;
  };

  const sendToSignalViewer = (processedBuffer, bands) => {
    const event = new CustomEvent("equalizerUpdated", {
      detail: {
        processedBuffer,
        bands,
        mode: currentMode,
        timestamp: Date.now(),
      },
    });
    window.dispatchEvent(event);
  };
  const logEqualizerEffects = (bands, metadata) => {
    if (!metadata?.frequencies) return;

    metadata.frequencies.forEach((freq) => {
      const affectingBands = bands.filter((band) => {
        const startFreq = band.centerFreq - band.width / 2;
        const endFreq = band.centerFreq + band.width / 2;
        return freq >= startFreq && freq <= endFreq;
      });

      if (affectingBands.length > 0) {
        const totalGain = affectingBands.reduce(
          (acc, band) => acc * band.gain,
          1
        );
        console.log(
          `${freq}Hz: ${
            affectingBands.length
          } band(s) → Gain: ${totalGain.toFixed(2)}x`
        );
      }
    });
  };

  const addSlider = (sliderData = {}) => {
    const newSlider = {
      id: Date.now(),
      centerFreq: sliderData.centerFreq || 1000,
      width: sliderData.width || 500,
      gain: sliderData.gain || 1.0,
      label: sliderData.label || `Band ${sliders.length + 1}`,
      ...sliderData,
    };
    const updatedSliders = [...sliders, newSlider];
    setSliders(updatedSliders);
    debouncedApply(updatedSliders);
    return newSlider;
  };

  const updateSlider = (sliderId, updates) => {
    const updatedSliders = sliders.map((slider) =>
      slider.id === sliderId ? { ...slider, ...updates } : slider
    );
    setSliders(updatedSliders);
    debouncedApply(updatedSliders);
  };

  const removeSlider = (sliderId) => {
    const updatedSliders = sliders.filter((slider) => slider.id !== sliderId);
    setSliders(updatedSliders);
    debouncedApply(updatedSliders);
  };

  const changeMode = (newMode) => {
    setCurrentMode(newMode);
  };

  const debouncedApply = useRef(_.debounce(applyEqualizer, 200)).current;

  const playAudio = (type = "output") => {
    const buffer = type === "input" ? inputSignal : outputSignal;
    if (!buffer || !audioContextRef.current) return;

    if (sourceRef.current) sourceRef.current.stop();

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    if (analyserRef.current) source.connect(analyserRef.current);
    source.connect(audioContextRef.current.destination);

    const startTime = audioContextRef.current.currentTime;
    source.start();

    sourceRef.current = source;
    startTimeRef.current = startTime;
    setIsPlaying(true);

    const updateTime = () => {
      if (!sourceRef.current) return;
      const elapsed =
        audioContextRef.current.currentTime - startTimeRef.current;
      if (elapsed >= buffer.duration) {
        setCurrentTime(buffer.duration);
        setIsPlaying(false);
        sourceRef.current = null;
        return;
      }
      setCurrentTime(elapsed);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    source.onended = () => {
      setIsPlaying(false);
      setCurrentTime(buffer.duration);
      sourceRef.current = null;
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  };

  const stopAudio = () => {
    if (sourceRef.current) sourceRef.current.stop();
    if (animationFrameRef.current)
      cancelAnimationFrame(animationFrameRef.current);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  return (
    <AudioContext.Provider
      value={{
        inputSignal,
        outputSignal,
        frequencyData,
        isPlaying,
        currentTime,
        sliders,
        currentMode,
        isProcessing,
        loadAudioFile,
        loadSyntheticSignal,
        applyEqualizer,
        playAudio,
        stopAudio,
        addSlider,
        updateSlider,
        removeSlider,
        changeMode,
        generateGainArray,
        getFrequencyBins,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
