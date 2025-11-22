// src/hooks/useWaveformManager.js
import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Custom hook to manage a waveform canvas with selectable frequency bands
 */
export const useWaveformManager = (inputSignal, sliders, selectedBand) => {
  const canvasRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  /**
   * Draws the complete waveform visualization
   */
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !inputSignal) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const data = inputSignal.getChannelData(0);
    const dataLength = data.length;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#1e293b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.3;
    for (let i = 0; i <= height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Center line
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Draw waveform
    const signalGradient = ctx.createLinearGradient(0, 0, width, 0);
    signalGradient.addColorStop(0, "#60a5fa");
    signalGradient.addColorStop(0.5, "#3b82f6");
    signalGradient.addColorStop(1, "#1d4ed8");
    ctx.strokeStyle = signalGradient;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const step = Math.ceil(dataLength / width);
    for (let i = 0; i < width; i++) {
      const index = Math.floor(i * step);
      if (index >= dataLength) break;

      const value = data[index];
      const y = height / 2 - value * (height * 0.4);

      if (i === 0) {
        ctx.moveTo(i, y);
      } else {
        ctx.lineTo(i, y);
      }
    }
    ctx.stroke();

    // Draw frequency bands
    if (sliders && Array.isArray(sliders)) {
      sliders.forEach((slider) => {
        const startFreq = Math.max(20, slider.centerFreq - slider.width / 2);
        const endFreq = Math.min(20000, slider.centerFreq + slider.width / 2);

        const startX = (startFreq / 20000) * width;
        const endX = (endFreq / 20000) * width;

        // Band color based on gain
        let color;
        if (slider.gain > 1) {
          color = `rgba(34, 197, 94, ${0.3 + (slider.gain - 1) * 0.15})`;
        } else if (slider.gain < 1) {
          color = `rgba(239, 68, 68, ${0.3 + (1 - slider.gain) * 0.15})`;
        } else {
          color = "rgba(156, 163, 175, 0.2)";
        }

        ctx.fillStyle = color;
        ctx.fillRect(startX, 0, endX - startX, height);

        // Highlight selected band
        if (slider.id === selectedBand?.id) {
          const centerX = (slider.centerFreq / 20000) * width;
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(centerX, 0);
          ctx.lineTo(centerX, height);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    // Draw selection rectangle
    if (selection && selection.width > 2) {
      const selectionGradient = ctx.createLinearGradient(
        selection.start,
        0,
        selection.end,
        0
      );
      selectionGradient.addColorStop(0, "rgba(59, 130, 246, 0.4)");
      selectionGradient.addColorStop(1, "rgba(139, 92, 246, 0.4)");

      ctx.fillStyle = selectionGradient;
      ctx.fillRect(selection.start, 0, selection.width, height);

      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;
      ctx.strokeRect(selection.start, 0, selection.width, height);
    }
  }, [inputSignal, sliders, selection, selectedBand]);

  /**
   * Main drawing effect
   */
  useEffect(() => {
    if (!inputSignal) return;
    const animationFrame = requestAnimationFrame(drawWaveform);
    return () => cancelAnimationFrame(animationFrame);
  }, [inputSignal, sliders, selection, selectedBand, drawWaveform]);

  /**
   * Sync selected band with visual selection
   * ⚠️ NOTE: We don't setCurrentSelection here anymore!
   * Let useBandsManager handle it to avoid conflicts
   */
  useEffect(() => {
    if (!selectedBand || !inputSignal) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Just log for debugging - don't update state
    console.log("🎨 Waveform syncing with band:", {
      bandId: selectedBand.id,
      centerFreq: selectedBand.centerFreq,
      width: selectedBand.width
    });

    // The visual will update automatically through drawWaveform
  }, [selectedBand?.id, selectedBand?.centerFreq, selectedBand?.width, inputSignal]);

  // Mouse handlers
  const handleMouseDown = (e) => {
    if (!inputSignal) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    setIsSelecting(true);
    setSelection({ start: x, end: x, width: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isSelecting || !selection || !inputSignal) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const boundedX = Math.max(0, Math.min(canvas.width, x));

    setSelection({
      start: Math.min(selection.start, boundedX),
      end: Math.max(selection.start, boundedX),
      width: Math.abs(boundedX - selection.start),
    });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selection || selection.width < 10) {
      setIsSelecting(false);
      return;
    }
    setIsSelecting(false);
  };

  const clearSelection = () => {
    setSelection(null);
    setIsSelecting(false);
  };

  const createBandFromSelection = () => {
    if (!selection || !inputSignal) {
      console.log("❌ No selection or audio signal");
      return null;
    }

    const canvas = canvasRef.current;
    if (!canvas) return null;

    const pixelWidth = canvas.width;
    const startFreq = (selection.start / pixelWidth) * 20000;
    const endFreq = (selection.end / pixelWidth) * 20000;
    const centerFreq = (startFreq + endFreq) / 2;
    const bandwidth = endFreq - startFreq;

    const totalSamples = inputSignal.length;
    const startSample = Math.floor((selection.start / pixelWidth) * totalSamples);
    const endSample = Math.floor((selection.end / pixelWidth) * totalSamples);

    const validatedSelection = {
      start: Math.max(0, selection.start),
      end: Math.min(pixelWidth, selection.end),
      width: Math.abs(selection.end - selection.start),
      startFreq,
      endFreq,
      centerFreq,
      startSample,
      endSample,
      sampleRate: inputSignal.sampleRate,
    };

    setTimeout(() => setSelection(null), 100);

    return {
      centerFreq: Math.max(20, Math.min(20000, centerFreq)),
      width: Math.max(50, Math.min(5000, bandwidth)),
      gain: 1.0,
      label: `${Math.round(centerFreq)}Hz Band`,
      region: validatedSelection,
    };
  };

  useEffect(() => {
    return () => {
      setSelection(null);
      setIsSelecting(false);
    };
  }, []);

  return {
    canvasRef,
    selection,
    isSelecting,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    clearSelection,
    createBandFromSelection,
    drawWaveform,
  };
};