// src/App.jsx
import React from "react";
import GenericMode from "./components/modes/GenericMode";
import { AudioProvider } from "./contexts/AudioContext";

function App() {
  return (
    <AudioProvider>
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <GenericMode />
          </div>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Signal Equalizer Project • Generic Mode Only</p>
          </div>
        </div>
      </div>
    </AudioProvider>
  );
}

export default App;
