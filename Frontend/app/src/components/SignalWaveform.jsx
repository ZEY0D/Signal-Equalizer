// src/components/SignalWaveform.jsx
import React, { useRef, useEffect, useState } from "react";
import { useAudio } from "../contexts/AudioContext";

const SignalWaveform = ({
  onFrequencyBandSelect,
  width = 800,
  height = 200,
}) => {
  const canvasRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const { inputSignal, addSlider } = useAudio();

  console.log("🚀 SignalWaveform rendered", {
    hasInputSignal: !!inputSignal,
    hasCanvas: !!canvasRef.current,
  });

  // رسم الموجة - نسخة مبسطة وموثوقة
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !inputSignal) return;

    console.log("🎨 Starting waveform drawing...");

    const ctx = canvas.getContext("2d");
    const data = inputSignal.getChannelData(0);
    const dataLength = data.length;

    // تنظيف
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    // خط الوسط
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // رسم الإشارة
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const step = Math.ceil(dataLength / width);
    let pointsDrawn = 0;

    for (let i = 0; i < width; i++) {
      const index = Math.floor(i * step);
      if (index >= dataLength) break;

      const value = data[index];
      const y = height / 2 - (value * height) / 3; // تضخيم للرؤية

      if (i === 0) {
        ctx.moveTo(i, y);
      } else {
        ctx.lineTo(i, y);
      }
      pointsDrawn++;
    }

    ctx.stroke();

    console.log(`✅ Waveform drawn: ${pointsDrawn} points`);

    // رسم التحديد
    if (selection && selection.width > 2) {
      ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
      ctx.fillRect(selection.start, 0, selection.width, height);
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 2;
      ctx.strokeRect(selection.start, 0, selection.width, height);
    }
  }, [inputSignal, selection, width, height]);

  const handleMouseDown = (e) => {
    if (!inputSignal) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    setIsSelecting(true);
    setSelection({ start: x, end: x, width: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isSelecting || !selection || !inputSignal) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    setSelection({
      start: Math.max(0, Math.min(selection.start, x)),
      end: Math.min(width, Math.max(selection.start, x)),
      width: Math.abs(x - selection.start),
    });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selection || selection.width < 10 || !inputSignal) {
      setIsSelecting(false);
      setSelection(null);
      return;
    }

    const totalSamples = inputSignal.length;
    const startSample = Math.floor((selection.start / width) * totalSamples);
    const endSample = Math.floor((selection.end / width) * totalSamples);

    const estimatedCenterFreq = 1000; // تردد افتراضي
    const bandwidth = 500;

    const newSlider = addSlider({
      centerFreq: estimatedCenterFreq,
      width: bandwidth,
      gain: 1.0,
      label: `Band @ ${estimatedCenterFreq}Hz`,
    });

    console.log("🎚️ New slider created:", newSlider);

    if (onFrequencyBandSelect) {
      onFrequencyBandSelect({
        startX: selection.start,
        endX: selection.end,
        startSample,
        endSample,
        centerFrequency: estimatedCenterFreq,
        bandwidth,
        slider: newSlider,
      });
    }

    setIsSelecting(false);
  };

  return (
    <div className="signal-waveform">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">🎵 Audio Waveform</h3>
        {inputSignal && (
          <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
            ✅ Loaded
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-4">
        {inputSignal
          ? "Click and drag to select a frequency region"
          : "Loading audio signal..."}
      </p>

      <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair border border-gray-300 rounded"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            background: "#f8fafc",
          }}
        />

        {selection && selection.width > 10 && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
            <div className="flex justify-between items-center">
              <span>
                Selected: <strong>{selection.width.toFixed(0)}px</strong>
              </span>
              <span className="text-blue-600 font-medium">
                Release to create band
              </span>
            </div>
          </div>
        )}

        {!inputSignal && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <div className="text-yellow-800">
              ⚠️ Waiting for audio signal to load...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default SignalWaveform;