// src/components/SliderController.jsx
import React, { useState } from "react";

const SliderController = ({ slider, onUpdate, onRemove, onPreview }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleGainChange = (value) => {
    onUpdate({ gain: parseFloat(value) });
  };

  const handleCenterFreqChange = (value) => {
    onUpdate({ centerFreq: parseFloat(value) });
  };

  const handleWidthChange = (value) => {
    onUpdate({ width: parseFloat(value) });
  };

  const handleLabelChange = (value) => {
    onUpdate({ label: value });
  };

  const calculateFrequencyRange = () => {
    const startFreq = slider.centerFreq - slider.width / 2;
    const endFreq = slider.centerFreq + slider.width / 2;
    return { startFreq, endFreq };
  };

  const getGainColor = (gain) => {
    if (gain === 1) return "text-gray-600";
    if (gain > 1) return "text-green-600";
    return "text-red-600";
  };

  const getGainIcon = (gain) => {
    if (gain === 1) return "⚖️";
    if (gain > 1) return "🔊";
    return "🔉";
  };

  const handleGainIconClick = () => {
    if (onPreview) {
      console.log("🔊 Gain preview requested for:", slider.gain);
      onPreview(slider.gain);
    } else {
      console.log("❌ onPreview function not available");
    }
  };

  const { startFreq, endFreq } = calculateFrequencyRange();

  return (
    <div className="border-2 border-gray-200 rounded-xl p-4 bg-white hover:bg-gray-50 transition-all duration-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 transition-transform"
          >
            {isExpanded ? "▼" : "►"}
          </button>

          <input
            type="text"
            value={slider.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="font-semibold text-lg bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1"
            placeholder="Band name..."
          />

          <span className={`text-sm font-medium ${getGainColor(slider.gain)}`}>
            {getGainIcon(slider.gain)} {slider.gain.toFixed(1)}x
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {startFreq.toFixed(0)}-{endFreq.toFixed(0)} Hz
          </span>
          <button
            onClick={onRemove}
            className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
            title="Remove band"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="space-y-4 mt-4 border-t pt-4">
          {/* Gain Control */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGainIconClick}
                  className={`text-lg transition-all duration-200 ${
                    onPreview
                      ? "hover:scale-110 cursor-pointer text-blue-600"
                      : "cursor-not-allowed text-gray-400"
                  }`}
                  title={
                    onPreview
                      ? "Test gain on selected region"
                      : "No region selected"
                  }
                >
                  🔊
                </button>
                <span className="block text-sm font-medium text-gray-700">
                  Gain Strength
                </span>
              </div>
              <span className="text-sm font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {slider.gain.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={slider.gain}
              onChange={(e) => handleGainChange(e.target.value)}
              className="w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Mute (0)</span>
              <span>Normal (1)</span>
              <span>Double (2)</span>
            </div>

            {/* Preview Hint */}
            {!onPreview && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                💡 Select a region on the waveform first to test gain effects
              </div>
            )}
          </div>

          {/* Center Frequency Control */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                📍 Center Frequency
              </label>
              <span className="text-sm font-mono bg-green-100 text-green-800 px-2 py-1 rounded">
                {slider.centerFreq.toFixed(0)} Hz
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="20000"
              step="10"
              value={slider.centerFreq}
              onChange={(e) => handleCenterFreqChange(e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>20 Hz</span>
              <span>10k Hz</span>
              <span>20k Hz</span>
            </div>
            <input
              type="number"
              min="20"
              max="20000"
              step="10"
              value={slider.centerFreq}
              onChange={(e) => handleCenterFreqChange(e.target.value)}
              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Width Control */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                📏 Band Width
              </label>
              <span className="text-sm font-mono bg-purple-100 text-purple-800 px-2 py-1 rounded">
                {slider.width.toFixed(0)} Hz
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="20000"
              step="50"
              value={slider.width}
              onChange={(e) => handleWidthChange(e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Narrow</span>
              <span>Medium</span>
              <span>Wide</span>
            </div>
          </div>

          {/* Band Information */}
          <div className="p-3 bg-gray-50 rounded-lg border">
            <h4 className="font-medium text-gray-800 mb-2">
              📊 Band Information
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Frequency Range:</span>
                <br />
                <span className="font-mono">
                  {startFreq.toFixed(0)} - {endFreq.toFixed(0)} Hz
                </span>
              </div>
              <div>
                <span className="text-gray-600">Effect:</span>
                <br />
                <span className={getGainColor(slider.gain)}>
                  {slider.gain === 1
                    ? "No change"
                    : slider.gain > 1
                    ? `Amplify ×${slider.gain.toFixed(1)}`
                    : `Reduce to ${(slider.gain * 100).toFixed(0)}%`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SliderController;