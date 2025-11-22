// src/components/SelectionDebugPanel.jsx
import React from 'react';

const SelectionDebugPanel = ({ currentSelection, selectedBand }) => {
  if (!currentSelection && !selectedBand) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg text-xs font-mono max-w-md z-50">
      <div className="font-bold text-sm mb-2 text-yellow-400">
        🐛 Debug Info
      </div>
      
      {selectedBand && (
        <div className="mb-3 pb-3 border-b border-gray-700">
          <div className="text-green-400 font-semibold mb-1">Selected Band:</div>
          <div>ID: {selectedBand.id}</div>
          <div>Label: {selectedBand.label}</div>
          <div>Center: {selectedBand.centerFreq.toFixed(0)} Hz</div>
          <div>Width: {selectedBand.width.toFixed(0)} Hz</div>
          <div>Gain: {selectedBand.gain.toFixed(2)}x</div>
        </div>
      )}

      {currentSelection && (
        <div>
          <div className="text-blue-400 font-semibold mb-1">Current Selection:</div>
          <div className="space-y-1">
            <div>Freq Range: {currentSelection.startFreq?.toFixed(0)} - {currentSelection.endFreq?.toFixed(0)} Hz</div>
            <div className="text-yellow-300">
              Sample Range: {currentSelection.startSample} - {currentSelection.endSample}
            </div>
            <div>
              Duration: {currentSelection.sampleRate 
                ? ((currentSelection.endSample - currentSelection.startSample) / currentSelection.sampleRate).toFixed(3) 
                : 'N/A'}s
            </div>
            <div>Total Samples: {currentSelection.totalSamples || 'N/A'}</div>
            <div>Sample Rate: {currentSelection.sampleRate || 'N/A'} Hz</div>
          </div>
        </div>
      )}

      {currentSelection && selectedBand && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-red-400 font-semibold mb-1">⚠️ Mismatch Check:</div>
          <div>
            Freq Match: {Math.abs(currentSelection.centerFreq - selectedBand.centerFreq) < 1 ? '✅' : '❌'}
          </div>
          <div>
            Width Match: {Math.abs(currentSelection.width - selectedBand.width) < 1 ? '✅' : '❌'}
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectionDebugPanel;