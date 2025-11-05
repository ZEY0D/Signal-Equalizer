// src/App.jsx
import React, { useState } from "react";
import GenericMode from "./components/GenericMode";
import { AudioProvider } from "./contexts/AudioContext";

// TODO: Import these components when they're ready
// import ModeSelector from "./components/ModeSelector";
// import MusicalMode from "./components/modes/MusicalMode";
// import AnimalMode from "./components/modes/AnimalMode";
// import HumanVoiceMode from "./components/modes/HumanVoiceMode";
// import SignalViewer from "./components/SignalViewer";
// import Spectrogram from "./components/Spectrogram";

// Temporary ModeSelector component
const ModeSelector = ({ currentMode, onModeChange }) => {
  return (
    <div className="flex justify-center mb-6">
      <div className="bg-white rounded-lg shadow-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          🎛️ Select Mode:
        </label>
        <select
          value={currentMode}
          onChange={(e) => onModeChange(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="generic">Generic Mode</option>
          <option value="musical" disabled>
            🎵 Musical Instruments (Coming Soon)
          </option>
          <option value="animal" disabled>
            🐾 Animal Sounds (Coming Soon)
          </option>
          <option value="human" disabled>
            🎤 Human Voices (Coming Soon)
          </option>
        </select>
        <p className="text-xs text-gray-500 mt-2">
          Currently only Generic Mode is available
        </p>
      </div>
    </div>
  );
};

// Temporary SignalViewer component
const SignalViewer = ({ type }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4">
        {type === "input" ? "🎤 Input Signal" : "🎧 Output Signal"}
      </h3>
      <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500 text-center">
          Signal Viewer Component
          <br />
          <span className="text-sm">(To be implemented by Student 3)</span>
        </p>
      </div>
      <div className="mt-4 flex justify-between">
        <button
          className="bg-gray-300 text-gray-700 px-4 py-2 rounded cursor-not-allowed"
          disabled
        >
          ▶️ Play
        </button>
        <div className="text-sm text-gray-600">
          Duration: --:-- | Sample Rate: ---
        </div>
      </div>
    </div>
  );
};

// Temporary Spectrogram component
const Spectrogram = () => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">📊 Spectrogram</h3>
        <div className="flex space-x-2">
          <button
            className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm cursor-not-allowed"
            disabled
          >
            Linear Scale
          </button>
          <button
            className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm cursor-not-allowed"
            disabled
          >
            Audiogram Scale
          </button>
        </div>
      </div>
      <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500 text-center">
          Spectrogram Visualization
          <br />
          <span className="text-sm">(To be implemented by Student 3)</span>
        </p>
      </div>
    </div>
  );
};

function App() {
  const [currentMode, setCurrentMode] = useState("generic");

  const renderMode = () => {
    switch (currentMode) {
      case "generic":
        return <GenericMode />;
      // case "musical":
      //   return <MusicalMode />;
      // case "animal":
      //   return <AnimalMode />;
      // case "human":
      //   return <HumanVoiceMode />;
      default:
        return <GenericMode />;
    }
  };

  return (
    <AudioProvider>
      <div className="min-h-screen bg-gray-100 p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎛️ Signal Equalizer
          </h1>
          <p className="text-lg text-gray-600">
            Real-time frequency manipulation with dynamic band control
          </p>
        </div>

        {/* Mode Selector */}
        <ModeSelector currentMode={currentMode} onModeChange={setCurrentMode} />

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mt-6">
          {/* Left Sidebar - Equalizer Controls */}
          <div className="xl:col-span-1">{renderMode()}</div>

          {/* Right Panel - Visualizations */}
          <div className="xl:col-span-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SignalViewer type="input" />
              <SignalViewer type="output" />
            </div>

            <div className="mb-6">
              <Spectrogram />
            </div>

            {/* System Status */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="text-yellow-500 text-lg mr-3">💡</div>
                <div>
                  <h4 className="font-semibold text-yellow-800 mb-1">
                    Development Status
                  </h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>
                      • ✅ <strong>Generic Mode</strong> - Complete and
                      functional
                    </li>
                    <li>
                      • 🚧 <strong>Signal Viewers</strong> - Under development
                      (Student 3)
                    </li>
                    <li>
                      • 🚧 <strong>Spectrogram</strong> - Under development
                      (Student 3)
                    </li>
                    <li>
                      • 📋 <strong>Custom Modes</strong> - Coming soon
                    </li>
                    <li>
                      • 🔗 <strong>Backend Processing</strong> - Ready for
                      integration (Student 1)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Signal Equalizer Project • Team Collaboration</p>
        </div>
      </div>
    </AudioProvider>
  );
}

export default App;
