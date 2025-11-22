// src/hooks/useAudioPlayback.js
import { useState, useRef } from "react";

export const useAudioPlayback = (inputSignal, speed) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingRegion, setIsPlayingRegion] = useState(false);
  const [isPlayingFull, setIsPlayingFull] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const audioSourceRef = useRef(null);
  const audioContextRef = useRef(null);

  const stopPlayback = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      } catch (e) {
        console.log("Already stopped");
      }
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsPlaying(false);
    setIsPlayingRegion(false);
    setIsPlayingFull(false);
    setCurrentlyPlaying(null);
  };

  const playSelectedRegion = (
    currentSelection,
    useGain = false,
    gainValue = 1.0
  ) => {
    console.log("🎵 playSelectedRegion called:", {
      currentSelection,
      useGain,
      gainValue,
      hasInputSignal: !!inputSignal,
    });

    if (!currentSelection || !inputSignal) {
      console.error("❌ Missing currentSelection or inputSignal");
      alert("❌ Please select a region first");
      return;
    }

    // التحقق من وجود startSample و endSample
    if (
      currentSelection.startSample === undefined ||
      currentSelection.endSample === undefined
    ) {
      console.error(
        "❌ Invalid selection - missing sample indices",
        currentSelection
      );
      alert("❌ Invalid audio region. Please select again.");
      return;
    }

    const startSample = currentSelection.startSample;
    const endSample = currentSelection.endSample;
    const segmentLength = endSample - startSample;

    if (segmentLength <= 0) {
      console.error("❌ Invalid segment length:", segmentLength);
      alert("❌ Invalid audio segment");
      return;
    }

    try {
      // Stop any current playback
      stopPlayback();

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const channelData = inputSignal.getChannelData(0);
      const audioData = new Float32Array(segmentLength);

      // Copy and apply gain
      for (let i = 0; i < segmentLength; i++) {
        const sourceIndex = startSample + i;
        if (sourceIndex < channelData.length) {
          const sample = channelData[sourceIndex];
          audioData[i] = useGain
            ? Math.max(-1.0, Math.min(1.0, sample * gainValue))
            : sample;
        }
      }

      // Create buffer
      const segmentBuffer = audioContext.createBuffer(
        1,
        segmentLength,
        inputSignal.sampleRate
      );
      segmentBuffer.getChannelData(0).set(audioData);

      // Resume and play
      audioContext.resume().then(() => {
        const source = audioContext.createBufferSource();
        source.buffer = segmentBuffer;
        source.playbackRate.value = speed[0];
        source.connect(audioContext.destination);
        source.start();

        audioSourceRef.current = source;
        setIsPlayingRegion(true);
        setIsPlaying(true);

        source.onended = () => {
          console.log("✅ Region playback finished");
          setIsPlayingRegion(false);
          setIsPlaying(false);
          audioSourceRef.current = null;
          audioContext.close();
          audioContextRef.current = null;
        };

        const duration = segmentLength / inputSignal.sampleRate;
        console.log(
          `🎵 Playing ${duration.toFixed(
            2
          )}s segment with gain ${gainValue}x at ${speed[0]}x speed`
        );
      });
    } catch (error) {
      console.error("❌ Error playing audio segment:", error);
      setIsPlayingRegion(false);
      setIsPlaying(false);
      alert("❌ Error playing audio. Check console.");
    }
  };

  const playFullSignal = (audioBuffer, signalType = "unknown") => {
    if (!audioBuffer) {
      console.log(`❌ No ${signalType} signal`);
      alert(`❌ No ${signalType} signal available`);
      return;
    }

    // Toggle stop if already playing this signal
    if (isPlayingFull && currentlyPlaying === signalType) {
      stopPlayback();
      return;
    }

    try {
      stopPlayback();

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      audioContext.resume().then(() => {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = speed[0];
        source.connect(audioContext.destination);
        source.start();

        audioSourceRef.current = source;
        setIsPlayingFull(true);
        setIsPlaying(true);
        setCurrentlyPlaying(signalType);

        source.onended = () => {
          console.log(`✅ ${signalType} playback finished`);
          setIsPlayingFull(false);
          setIsPlaying(false);
          setCurrentlyPlaying(null);
          audioSourceRef.current = null;
          audioContext.close();
          audioContextRef.current = null;
        };

        console.log(
          `🎵 Playing FULL ${signalType} signal at ${speed[0]}x speed`
        );
      });
    } catch (error) {
      console.error(`❌ Error playing ${signalType}:`, error);
      setIsPlayingFull(false);
      setIsPlaying(false);
      setCurrentlyPlaying(null);
    }
  };

  return {
    isPlaying,
    setIsPlaying,
    isPlayingRegion,
    isPlayingFull,
    currentlyPlaying,
    playSelectedRegion,
    playFullSignal,
    stopPlayback,
    audioSourceRef,
  };
};
