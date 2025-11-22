 // src/components/SliderController.jsx
import React, { useState , useEffect } from "react";

/**
 * Enhanced SliderController component with real-time gain preview
 * Applies gain changes to the currently selected audio region
 * 
 * @param {Object} slider - The slider configuration object
 * @param {Function} onUpdate - Callback when slider values change
 * @param {Function} onRemove - Callback to remove this slider
 * @param {Function} onPreview - Callback to preview gain on current selection
 * @param {Object} currentSelection - The currently selected audio region for preview
 */
const SliderController = ({ 
  slider, 
  onUpdate, 
  onRemove, 
  onPreview,
  currentSelection 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  // 🔍 Debug: راقبي تغييرات currentSelection
  useEffect(() => {
    console.log("🔄 SliderController: currentSelection changed!", {
      sliderId: slider.id,
      sliderLabel: slider.label,
      hasSelection: !!currentSelection,
      samples: currentSelection ? 
        `${currentSelection.startSample}-${currentSelection.endSample}` : 
        'NO SELECTION',
      freq: currentSelection ?
        `${currentSelection.startFreq?.toFixed(0)}-${currentSelection.endFreq?.toFixed(0)} Hz` :
        'NO FREQ'
    });
  }, [currentSelection, slider.id, slider.label]);
  
  // 🔍 Debug: راقبي تغييرات slider
  useEffect(() => {
    console.log("🎛️ SliderController: slider changed!", {
      id: slider.id,
      label: slider.label,
      centerFreq: slider.centerFreq,
      width: slider.width,
      gain: slider.gain
    });
  }, [slider.centerFreq, slider.width, slider.gain]);
  // Check if we have a valid selection for preview
  const hasValidSelection = currentSelection && 
                           currentSelection.startSample !== undefined && 
                           currentSelection.endSample !== undefined;

const handleGainChange = (value) => {
  const newGain = parseFloat(value);
  console.log("🎚️ Gain changed:", {
    old: slider.gain,
    new: newGain,
    willPreview: hasValidSelection && newGain !== 1.0
  });
  onUpdate({ gain: newGain });

  // Auto-preview when gain changes
  if (hasValidSelection && newGain !== 1.0) {
    triggerGainPreview(newGain);
  }
};


const handleCenterFreqChange = (value) => {
  const newCenterFreq = parseFloat(value);
  console.log("📍 Center Freq changing from", slider.centerFreq, "to", newCenterFreq);
  console.log("   Current selection BEFORE update:", currentSelection ? 
    `samples: ${currentSelection.startSample}-${currentSelection.endSample}` : 
    'NO SELECTION');
  
  onUpdate({ centerFreq: newCenterFreq });
  
  // الـ selection المفروض يتحدث فوراً بعد onUpdate
  setTimeout(() => {
    console.log("   Current selection AFTER update:", currentSelection ? 
      `samples: ${currentSelection.startSample}-${currentSelection.endSample}` : 
      'STILL NO SELECTION');
  }, 50);
};

const handleWidthChange = (value) => {
  const newWidth = parseFloat(value);
  console.log("📏 Width changing from", slider.width, "to", newWidth);
  console.log("   Current selection BEFORE update:", currentSelection ? 
    `samples: ${currentSelection.startSample}-${currentSelection.endSample}` : 
    'NO SELECTION');
  
  onUpdate({ width: newWidth });
  
  setTimeout(() => {
    console.log("   Current selection AFTER update:", currentSelection ? 
      `samples: ${currentSelection.startSample}-${currentSelection.endSample}` : 
      'STILL NO SELECTION');
  }, 50);
};

  const handleLabelChange = (value) => {
    onUpdate({ label: value });
  };

  /**
   * Triggers gain preview with visual feedback
   */
  const triggerGainPreview = async (gain = slider.gain) => {
    if (!hasValidSelection || !onPreview) {
      console.log("❌ Cannot preview: No valid selection or preview function");
      return;
    }

    try {
      setIsPreviewing(true);
      console.log("🎵 Previewing gain:", {
        gain,
        selection: {
          startSample: currentSelection.startSample,
          endSample: currentSelection.endSample,
          frequencyRange: `${currentSelection.startFreq.toFixed(0)}-${currentSelection.endFreq.toFixed(0)} Hz`
        }
      });
      
      await onPreview(gain, currentSelection);
      
      // Auto-stop preview after 2 seconds
      setTimeout(() => {
        setIsPreviewing(false);
      }, 2000);
      
    } catch (error) {
      console.error("🔴 Preview error:", error);
      setIsPreviewing(false);
    }
  };

  /**
   * Stops any active preview
   */
  const stopPreview = () => {
    if (onPreview) {
      onPreview(1.0, currentSelection); // Reset to normal gain
    }
    setIsPreviewing(false);
  };

  const calculateFrequencyRange = () => {
    const startFreq = Math.max(20, slider.centerFreq - slider.width / 2);
    const endFreq = Math.min(20000, slider.centerFreq + slider.width / 2);
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

  const getPreviewButtonState = () => {
    if (!hasValidSelection) {
      return {
        icon: "🔇",
        tooltip: "Select a region on waveform first",
        className: "cursor-not-allowed text-gray-400",
        disabled: true
      };
    }
    
    if (isPreviewing) {
      return {
        icon: "⏹️",
        tooltip: "Stop preview",
        className: "cursor-pointer text-red-600 hover:scale-110",
        disabled: false
      };
    }
    
    return {
      icon: "👂",
      tooltip: `Preview gain on selected region (${currentSelection.startFreq.toFixed(0)}-${currentSelection.endFreq.toFixed(0)} Hz)`,
      className: "cursor-pointer text-blue-600 hover:scale-110",
      disabled: false
    };
  };

  const { startFreq, endFreq } = calculateFrequencyRange();
  const previewButton = getPreviewButtonState();

  return (
    <div className={`border-2 rounded-xl p-4 transition-all duration-200 ${
      isPreviewing 
        ? "border-blue-400 bg-blue-50 shadow-lg" 
        : "border-gray-200 bg-white hover:bg-gray-50"
    }`}>
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
          {/* Gain Control with Enhanced Preview */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={isPreviewing ? stopPreview : () => triggerGainPreview()}
                  disabled={previewButton.disabled}
                  className={`text-lg transition-all duration-200 ${previewButton.className}`}
                  title={previewButton.tooltip}
                >
                  {previewButton.icon}
                </button>
                <span className="block text-sm font-medium text-gray-700">
                  Gain Strength
                  {isPreviewing && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded animate-pulse">
                      PREVIEWING
                    </span>
                  )}
                </span>
              </div>
              <span className={`text-sm font-mono px-2 py-1 rounded ${
                slider.gain === 1 ? "bg-gray-100 text-gray-800" :
                slider.gain > 1 ? "bg-green-100 text-green-800" :
                "bg-red-100 text-red-800"
              }`}>
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

            {/* Selection Info & Auto-preview */}
            <div className="mt-3 space-y-2">
              {hasValidSelection ? (
                <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                  <div className="font-medium">🎯 Preview Ready</div>
                  <div>Region: {currentSelection.startFreq.toFixed(0)}-{currentSelection.endFreq.toFixed(0)} Hz</div>
                  <div>Samples: {currentSelection.startSample}-{currentSelection.endSample}</div>
                  <div className="text-green-600 mt-1">
                    💡 Gain changes auto-preview on selected region
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  <div className="font-medium">⏳ Waiting for Selection</div>
                  <div>Select a region on the waveform to enable gain preview</div>
                </div>
              )}
            </div>
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

          {/* Enhanced Band Information */}
          <div className={`p-3 rounded-lg border ${
            isPreviewing ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"
          }`}>
            <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
              📊 Band Information
              {isPreviewing && (
                <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full animate-pulse">
                  LIVE
                </span>
              )}
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
            
            {/* Current Selection Info */}
            {hasValidSelection && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600 mb-1">🎯 Preview Target:</div>
                <div className="text-xs font-mono bg-blue-100 text-blue-800 p-2 rounded">
                  Samples {currentSelection.startSample} - {currentSelection.endSample}
                  <br />
                  ({currentSelection.startFreq.toFixed(0)}-{currentSelection.endFreq.toFixed(0)} Hz)
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SliderController;