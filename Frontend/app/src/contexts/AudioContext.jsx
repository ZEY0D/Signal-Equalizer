// src/contexts/AudioContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,

  
} from "react";
import { createSyntheticAudioBuffer } from "../utils/syntheticSignal";
import { processAudioWithBackend, checkBackendHealth } from "../utils/audioApi";
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
  const [backendAvailable, setBackendAvailable] = useState(false);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const startTimeRef = useRef(0);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    initializeAudio();
    loadSyntheticSignal();
    checkBackend();
  }, []);

  const checkBackend = async () => {
    const isAvailable = await checkBackendHealth();
    setBackendAvailable(isAvailable);
    if (isAvailable) {
      console.log("✅ Backend connected successfully");
    } else {
      console.warn("⚠️ Backend unavailable - using fallback processing");
    }
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
          gains[i] *= smoothGain;
        }
      }
    });

    return gains;
  };

  const applyEqualizer = async (bands) => {
    if (!inputSignal || !audioContextRef.current) return;

    setIsProcessing(true);

    try {
      const frequencyBins = getFrequencyBins();
      const gainArray = generateGainArray(bands, frequencyBins);
      
      // محاولة استخدام Backend أولاً
      let processedBuffer;
      
      if (backendAvailable) {
        try {
          console.log("🔄 Processing with backend...");
          processedBuffer = await processWithBackend(
            inputSignal,
            bands,
            gainArray
          );
          console.log("✅ Backend processing successful");
        } catch (backendError) {
          console.warn("⚠️ Backend failed, using fallback:", backendError);
          processedBuffer = applySimpleProcessing(inputSignal, gainArray);
        }
      } else {
        // استخدام الـ fallback مباشرةً
        console.log("⚡ Using client-side processing");
        processedBuffer = applySimpleProcessing(inputSignal, gainArray);
      }

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
      // استخدام الـ API utility
      const result = await processAudioWithBackend(
        audioBuffer,
        bands,
        gainArray,
        currentMode
      );

      // تحويل النتيجة لـ AudioBuffer
      const processedBuffer = audioContextRef.current.createBuffer(
        1,
        result.processedAudio.length,
        audioBuffer.sampleRate
      );
      processedBuffer.getChannelData(0).set(result.processedAudio);
      
      // حفظ metadata للتحليل
      processedBuffer.metadata = result.metadata;
      
      return processedBuffer;
      
    } catch (error) {
      console.error("Backend processing error:", error);
      throw error; // نرمي الخطأ للـ fallback
    }
  };

  const applySimpleProcessing = (audioBuffer, gainArray) => {
    console.log("🔧 Applying client-side processing...");
    
    const clonedBuffer = audioContextRef.current.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // معالجة بسيطة في الـ time domain
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const inputData = audioBuffer.getChannelData(ch);
      const outputData = clonedBuffer.getChannelData(ch);

      // تطبيق Gain مباشر (تقريبي)
      const avgGain = gainArray.reduce((a, b) => a + b, 0) / gainArray.length;
      
      for (let i = 0; i < audioBuffer.length; i++) {
        outputData[i] = inputData[i] * avgGain;
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
        backendAvailable,
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
        checkBackend,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};