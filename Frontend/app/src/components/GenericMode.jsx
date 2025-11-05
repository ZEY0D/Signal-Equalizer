// src/components/modes/GenericMode.jsx
import React, { useState, useEffect } from "react";
import SliderController from "./SliderController";
import { useAudio } from "../contexts/AudioContext";
// import { saveAs } from "file-saver";

const GenericMode


= () => {
  const {
    sliders,
    addSlider,
    updateSlider,
    removeSlider,
    applyEqualizer,
    isProcessing,
  } = useAudio();

  const [localSliders, setLocalSliders] = useState([]);

  // Sync local state with global audio context
  useEffect(() => {
    setLocalSliders(sliders);
  }, [sliders]);

  // Add default sliders when component mounts
  useEffect(() => {
    if (sliders.length === 0) {
      addDefaultSliders();
    }
  }, []);

  const addDefaultSliders = () => {
    const defaultSliders = [
      {
        centerFreq: 100,
        width: 150,
        gain: 1.0,
        label: "Bass",
      },
      {
        centerFreq: 1000,
        width: 800,
        gain: 1.0,
        label: "Mid",
      },
      {
        centerFreq: 5000,
        width: 3000,
        gain: 1.0,
        label: "Treble",
      },
    ];

    defaultSliders.forEach((slider) => addSlider(slider));
  };

  const handleAddSlider = () => {
    const newSlider = {
      centerFreq: 1000,
      width: 500,
      gain: 1.0,
      label: `Band ${sliders.length + 1}`,
    };
    addSlider(newSlider);
  };

  const handleUpdateSlider = (sliderId, updates) => {
    updateSlider(sliderId, updates);
  };

  const handleRemoveSlider = (sliderId) => {
    removeSlider(sliderId);
  };

  const handleResetAll = () => {
    // Reset all gains to 1.0
    const resetSliders = sliders.map((slider) => ({
      ...slider,
      gain: 1.0,
    }));

    resetSliders.forEach((slider) => {
      updateSlider(slider.id, { gain: 1.0 });
    });
  };

  const saveSettings = () => {
    const settings = {
      mode: "generic",
      sliders: sliders.map((slider) => ({
        id: slider.id,
        centerFreq: slider.centerFreq,
        width: slider.width,
        gain: slider.gain,
        label: slider.label,
      })),
      timestamp: new Date().toISOString(),
      version: "1.0",
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    saveAs(blob, "generic-equalizer-settings.json");
  };

  const loadSettings = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);

        if (settings.mode === "generic" && settings.sliders) {
          // Clear existing sliders
          sliders.forEach((slider) => removeSlider(slider.id));

          // Add loaded sliders
          setTimeout(() => {
            settings.sliders.forEach((sliderData) => {
              addSlider(sliderData);
            });
          }, 100);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        alert("Error loading settings file. Please check the file format.");
      }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = "";
  };

  const exportFrequencyRanges = () => {
    const ranges = sliders.map((slider) => {
      const startFreq = slider.centerFreq - slider.width / 2;
      const endFreq = slider.centerFreq + slider.width / 2;
      return {
        label: slider.label,
        range: `${startFreq.toFixed(0)}Hz - ${endFreq.toFixed(0)}Hz`,
        center: slider.centerFreq,
        width: slider.width,
        gain: slider.gain,
      };
    });

    console.log("🎯 Current Frequency Ranges:", ranges);
    alert("Frequency ranges exported to console! Check developer tools.");
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🎛️ Generic Mode</h2>
          <p className="text-sm text-gray-600 mt-1">
            Divide the frequency range into custom bands and adjust their gain
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isProcessing && (
            <div className="flex items-center text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Processing...
            </div>
          )}
        </div>
      </div>

      {/* Controls Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={handleAddSlider}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
        >
          <span className="mr-2">➕</span>
          Add Band
        </button>

        <button
          onClick={handleResetAll}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
        >
          <span className="mr-2">🔄</span>
          Reset All
        </button>

        <button
          onClick={saveSettings}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
        >
          <span className="mr-2">💾</span>
          Save Settings
        </button>

        <label className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center cursor-pointer">
          <span className="mr-2">📁</span>
          Load Settings
          <input
            type="file"
            accept=".json"
            onChange={loadSettings}
            className="hidden"
          />
        </label>
      </div>

      {/* Info Panel */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <div className="text-blue-500 text-lg mr-3">💡</div>
          <div>
            <h3 className="font-semibold text-blue-800 mb-1">How to Use</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                • <strong>Add bands</strong> to control specific frequency
                ranges
              </li>
              <li>
                • Adjust <strong>center frequency</strong> and{" "}
                <strong>width</strong> to target specific sounds
              </li>
              <li>
                • Use <strong>gain</strong> to amplify (＞1) or reduce (＜1)
                each band
              </li>
              <li>• Changes apply in real-time to the audio signal</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sliders Container */}
      <div className="space-y-4">
        {localSliders.map((slider) => (
          <SliderController
            key={slider.id}
            slider={slider}
            onUpdate={(updates) => handleUpdateSlider(slider.id, updates)}
            onRemove={() => handleRemoveSlider(slider.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {localSliders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎵</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Frequency Bands Yet
          </h3>
          <p className="text-gray-500 mb-6">
            Start by adding your first frequency band to control specific parts
            of the audio signal.
          </p>
          <button
            onClick={handleAddSlider}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium text-lg"
          >
            ➕ Add Your First Band
          </button>
        </div>
      )}

      {/* Footer Actions */}
      {localSliders.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <strong>{localSliders.length}</strong> band(s) active • Total
              frequency coverage:{" "}
              {localSliders
                .reduce((total, slider) => total + slider.width, 0)
                .toFixed(0)}
              Hz
            </div>

            <button
              onClick={exportFrequencyRanges}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm"
            >
              📊 Export Ranges
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenericMode;
