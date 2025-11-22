import React, { useEffect } from "react";
import { useAudio } from "../../contexts/AudioContext";
import { useBandsManager } from "./hooks/useBandsManager";
import { useWaveformManager } from "./hooks/useWaveformManager";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { SpeedSlider } from "../ui/SpeedSlider";
import SliderController from "../SliderController";
import FrequencyGraph from "./FrequencyGraph"; 
import "./GenericMode.css";

const GenericMode = () => {
  const {
    inputSignal,
    outputSignal,
    isProcessing,
    loadSyntheticSignal,
  } = useAudio();

  // State for speed
  const [speed, setSpeed] = React.useState([1]);
  
  // State for active tab
  const [activeTab, setActiveTab] = React.useState("equalizer");

  // Custom hooks
  const bands = useBandsManager();
  const waveform = useWaveformManager(inputSignal, bands.sliders, bands.selectedBand);
  const playback = useAudioPlayback(inputSignal, speed);

  // Load synthetic signal on mount
  useEffect(() => {
    if (!inputSignal) {
      loadSyntheticSignal();
    }
  }, [inputSignal, loadSyntheticSignal]);

  // Handle band creation from selection
 const handleCreateBandFromSelection = () => {
  const bandData = waveform.createBandFromSelection();
  if (bandData) {
    const newSlider = bands.handleAddSlider({
      centerFreq: bandData.centerFreq,
      width: bandData.width,
      gain: bandData.gain,
      label: bandData.label,
    });
    
    // Save region with complete data including samples
    const completeRegion = {
      ...bandData.region,
      totalSamples: inputSignal.length, // 🔥 أضيفي total samples
    };
    bands.saveRegionForBand(newSlider.id, completeRegion);
    bands.handleSelectBand(newSlider, inputSignal); 
    bands.setCurrentSelection(completeRegion);
  }
};

  const handleBandPreview = (gain, selection) => {
    const targetSelection = selection || bands.currentSelection;
    console.log("🎵 BAND PREVIEW CALLED:", {
      gain,
      hasSelection: !!targetSelection,
      selection: targetSelection,
      sliderGain: bands.selectedBand?.gain
    });
    
    if (!targetSelection) {
      alert(`🎵 No audio region selected!

To test gain effects:
1. 📍 Click and drag on the waveform to select a region
2. 🎛️ Click 'Create Frequency Band' 
3. 🔊 Adjust the gain slider
4. 👂 Click the speaker icon to preview

Selected region will be highlighted in blue on the waveform.`);
      return;
    }

    // تحقق من صحة الـ selection
    if (targetSelection.startSample >= targetSelection.endSample) {
      alert("❌ Invalid audio region selected\nPlease select a larger region on the waveform");
      return;
    }

    const sampleCount = targetSelection.endSample - targetSelection.startSample;
    const duration = sampleCount / targetSelection.sampleRate;
    
    if (duration < 0.05) {
      alert("⏱️ Selected region is too short\nPlease select a longer region (at least 0.1 seconds)");
      return;
    }

    console.log("🎵 Starting gain preview:", {
      gain,
      selection: targetSelection,
      samples: `${targetSelection.startSample}-${targetSelection.endSample}`,
      duration: `${duration.toFixed(3)}s`,
      frequencyRange: `${targetSelection.startFreq.toFixed(0)}-${targetSelection.endFreq.toFixed(0)} Hz`
    });
    
    // شغل الـ preview
    playback.playSelectedRegion(targetSelection, true, gain);
  };

  // Handle play region without gain
  const handlePlayRegion = () => {
    if (!bands.currentSelection) {
      alert("❌ Please select a region and create a band first");
      return;
    }
    playback.playSelectedRegion(bands.currentSelection, false, 1.0);
  };

  // Handle play full signals
  const handlePlayInputSignal = () => {
    playback.playFullSignal(inputSignal, "input");
  };

  const handlePlayOutputSignal = () => {
    if (!outputSignal) {
      alert("❌ No processed signal available yet");
      return;
    }
    playback.playFullSignal(outputSignal, "output");
  };

  // Render content based on active tab
  const renderContent = () => {
    if (activeTab === "frequencyGraph") {
      return <FrequencyGraph />;
    }

    // Default tab: Equalizer
    return (
      <div className="main-content">
        {/* Left Panel - Waveform and Bands */}
        <div className="left-panel">
          {/* Input Signal Waveform */}
          <div className="waveform-container">
            <div className="section-header">
              <h2 className="section-title">🎵 Input Signal</h2>
              {inputSignal && (
                <div className="signal-info">
                  <span className="duration">
                    {inputSignal.duration?.toFixed(2)}s
                  </span>
                  <span className="sample-rate">
                    {inputSignal.sampleRate}Hz
                  </span>
                  {bands.currentSelection && (
                    <span className="region-saved">🎯 Region Saved</span>
                  )}
                  <button
                    onClick={handlePlayInputSignal}
                    className={`play-signal-btn ${
                      playback.currentlyPlaying === "input" ? "playing" : ""
                    }`}
                  >
                    {playback.currentlyPlaying === "input" ? "⏹️" : "▶️"}
                  </button>
                </div>
              )}
            </div>

            <div className="waveform-wrapper">
              <canvas
                ref={waveform.canvasRef}
                width={800}
                height={200}
                onMouseDown={waveform.handleMouseDown}
                onMouseMove={waveform.handleMouseMove}
                onMouseUp={waveform.handleMouseUp}
                onMouseLeave={waveform.handleMouseUp}
                className="waveform"
              />

              {waveform.selection && waveform.selection.width > 5 && (
                <div className="selection-popup">
                  <div className="popup-header">
                    <div className="popup-title">
                      <div className="pulse-dot"></div>
                      Region Selected
                    </div>
                    <button onClick={waveform.clearSelection} className="close-popup">
                      ✕
                    </button>
                  </div>

                  <div className="popup-info">
                    <div className="info-item">
                      <span className="info-label">Width</span>
                      <span className="info-value">
                        {waveform.selection.width.toFixed(0)}px
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Frequencies</span>
                      <span className="info-value">
                        {Math.round((waveform.selection.start / 800) * 20000)} -{" "}
                        {Math.round((waveform.selection.end / 800) * 20000)} Hz
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCreateBandFromSelection}
                    className="create-band-btn"
                  >
                    <span className="btn-icon">🎛️</span>
                    Create Frequency Band
                  </button>
                </div>
              )}
            </div>

            <div className="frequency-scale">
              <span>20Hz</span>
              <span>500Hz</span>
              <span>2kHz</span>
              <span>8kHz</span>
              <span>20kHz</span>
            </div>

            <div className="signal-info-panel">
              <p className="info-text">
                💡 <strong>Synthetic Signal Contains:</strong> 50Hz, 100Hz,
                250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 12kHz
              </p>
              {bands.currentSelection && bands.selectedBand && (
                <div className="success-text">
                  <div>✅ Region saved for {bands.selectedBand.label}</div>
                  <div className="text-xs mt-1 opacity-75">
                    {bands.currentSelection.startSample} -{" "}
                    {bands.currentSelection.endSample} samples (
                    {(
                      (bands.currentSelection.endSample -
                        bands.currentSelection.startSample) /
                      bands.currentSelection.sampleRate
                    ).toFixed(3)}
                    s)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Output Signal Waveform */}
          {outputSignal && (
            <div className="waveform-container output-signal">
              <div className="section-header">
                <h2 className="section-title">🎧 Processed Signal</h2>
                <div className="signal-info">
                  <span className="duration">
                    {outputSignal.duration?.toFixed(2)}s
                  </span>
                  <span className="sample-rate">
                    {outputSignal.sampleRate}Hz
                  </span>
                  <span className="speed-indicator">⚡ {speed[0].toFixed(1)}x</span>
                  <button
                    onClick={handlePlayOutputSignal}
                    className={`play-signal-btn ${
                      playback.currentlyPlaying === "output" ? "playing" : ""
                    }`}
                  >
                    {playback.currentlyPlaying === "output" ? "⏹️" : "▶️"}
                  </button>
                </div>
              </div>

              <div className="waveform-wrapper">
                <div className="processed-waveform-placeholder">
                  <p className="text-muted-foreground text-sm">
                    Processed waveform display
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Output signal visualization
                  </p>
                </div>
              </div>

              <div className="frequency-scale">
                <span>20Hz</span>
                <span>500Hz</span>
                <span>2kHz</span>
                <span>8kHz</span>
                <span>20kHz</span>
              </div>
            </div>
          )}

          {/* Bands List */}
          <div className="bands-container">
            <div className="section-header">
              <h2 className="section-title">
                Frequency Bands{" "}
                <span className="count-badge">{bands.sliders.length}</span>
              </h2>
              <div className="header-actions">
                <button
                  onClick={bands.handleClearAllSliders}
                  className="clear-all-btn"
                  disabled={bands.sliders.length === 0}
                >
                  <span className="btn-icon">🗑️</span>
                  Clear All
                </button>
                <button
                  onClick={bands.handleSaveSettings}
                  className="save-settings-btn"
                  disabled={bands.sliders.length === 0}
                >
                  <span className="btn-icon">💾</span>
                  Save Settings
                </button>
              </div>
            </div>

            <div className="bands-grid">
              {bands.sliders.map((slider) => {
                const hasRegion = bands.getRegionForBand(slider.id);
                return (
                  <div
                    key={slider.id}
                    onClick={() => bands.handleSelectBand(slider, inputSignal)}
                    className={`band-card ${
                      bands.selectedBand?.id === slider.id ? "selected" : ""
                    }`}
                  >
                    <div className="band-header">
                      <span className="band-name">
                        {slider.label}
                        {hasRegion && (
                          <span
                            className="region-indicator"
                            title="Has selected region for preview"
                          >
                            {" "}
                            🎯
                          </span>
                        )}
                      </span>
                      <span
                        className={`band-gain-indicator ${
                          slider.gain > 1
                            ? "boost"
                            : slider.gain < 1
                            ? "cut"
                            : "neutral"
                        }`}
                      >
                        {slider.gain > 1
                          ? `🔊 +${((slider.gain - 1) * 100).toFixed(0)}%`
                          : slider.gain < 1
                          ? `🔉 -${((1 - slider.gain) * 100).toFixed(0)}%`
                          : "⚖️ 0%"}
                      </span>
                    </div>
                    <div className="band-frequency">
                      {Math.round(slider.centerFreq - slider.width / 2)} -{" "}
                      {Math.round(slider.centerFreq + slider.width / 2)} Hz
                    </div>
                  </div>
                );
              })}
            </div>

            {bands.sliders.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🎵</div>
                <h3 className="empty-title">No frequency bands yet</h3>
                <p className="empty-description">
                  Select a region on the waveform or click "Add Band" to
                  create your first band
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Controls */}
        <div className="right-panel">
          <div className="controls-container">
            {bands.selectedBand ? (
              <>
                <div className="controls-header">
                  <h2 className="controls-title">
                    Editing:{" "}
                    <span className="band-name">{bands.selectedBand.label}</span>
                  </h2>
                  <div className="controls-actions">
                    {bands.currentSelection && (
                      <span className="region-ready-badge">
                        🎯 Region Ready
                      </span>
                    )}
                    <button
                      onClick={() => bands.setSelectedBand(null)}
                      className="close-controls"
                    >
                      ✕
                    </button>
                  </div>
                </div>

<SliderController
  key={`${bands.selectedBand.id}-${bands.currentSelection?.startSample}-${bands.currentSelection?.endSample}`}
  slider={bands.selectedBand}
  onUpdate={(updates) =>
    bands.handleUpdateSlider(bands.selectedBand.id, updates)
  }
  onRemove={() => bands.handleRemoveSlider(bands.selectedBand.id)}
  onPreview={handleBandPreview}  
  currentSelection={bands.currentSelection}
/>
              </>
            ) : (
              <div className="no-band-selected">
                <div className="no-band-icon">🎛️</div>
                <h3 className="no-band-title">No Band Selected</h3>
                <p className="no-band-description">
                  Click on a frequency band to edit its settings, or create a
                  new band
                </p>
              </div>
            )}

            <div className="quick-actions-panel">
              <h3 className="actions-title">Quick Actions</h3>
              <div className="actions-grid">
                <button
                  onClick={bands.handleAddNewBand}
                  className="action-btn add-band"
                >
                  <span className="btn-icon">➕</span>
                  Add Band
                </button>
                <button
                  onClick={bands.handleResetAllGains}
                  className="action-btn reset-gains"
                  disabled={bands.sliders.length === 0}
                >
                  <span className="btn-icon">⚖️</span>
                  Reset Gains
                </button>
                <button
                  onClick={bands.handleClearAllSliders}
                  className="action-btn clear-all"
                  disabled={bands.sliders.length === 0}
                >
                  <span className="btn-icon">🗑️</span>
                  Clear All
                </button>
              </div>
              {bands.currentSelection && (
                <div className="preview-hint">
                  💡 Click the 🔊 speaker icon in the gain control to test
                  effects on your selected region
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="generic-mode">
      <div className="generic-container">
        {/* Header */}
        <div className="app-header">
          <div className="header-content">
            <div className="header-text">
              <h1 className="app-title">🎛️ Audio Equalizer</h1>
              <p className="app-subtitle">
                Real-time frequency control with instant preview
              </p>
            </div>

            {/* Tabs Navigation */}
            <div className="tabs-navigation">
              <button
                className={`tab-button ${activeTab === "equalizer" ? "active" : ""}`}
                onClick={() => setActiveTab("equalizer")}
              >
                🎛️ Equalizer
              </button>
              <button
                className={`tab-button ${activeTab === "frequencyGraph" ? "active" : ""}`}
                onClick={() => setActiveTab("frequencyGraph")}
              >
                📊 Frequency Graph
              </button>
            </div>

            <div className="header-controls">
              <div className="control-buttons">
                <button
                  onClick={handlePlayRegion}
                  disabled={!bands.currentSelection || playback.isPlayingRegion}
                  className={`play-region-btn ${
                    bands.currentSelection && !playback.isPlayingRegion ? "active" : "disabled"
                  }`}
                  title="Play selected region without gain"
                >
                  <span className="btn-icon">▶️</span>
                  Play Region
                </button>

                <button
                  onClick={handlePlayInputSignal}
                  className={`play-full-btn ${
                    playback.currentlyPlaying === "input" ? "stop" : "play"
                  }`}
                  title={
                    playback.currentlyPlaying === "input" 
                      ? "Stop input playback" 
                      : "Play full input signal"
                  }
                >
                  <span className="btn-icon">
                    {playback.currentlyPlaying === "input" ? "⏹️" : "🎵"}
                  </span>
                  {playback.currentlyPlaying === "input" ? "Stop Input" : "Play Input"}
                </button>
              </div>

              {/* Speed Control */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <label htmlFor="speed" className="whitespace-nowrap text-sm">
                  Speed
                </label>
                <SpeedSlider
                  id="speed"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={speed}
                  onValueChange={setSpeed}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-10 text-right">
                  {speed[0].toFixed(1)}x
                </span>
              </div>

              <div className="status-indicators">
                {isProcessing && (
                  <div className="processing-indicator">
                    <div className="spinner"></div>
                    Processing...
                  </div>
                )}
                {inputSignal && (
                  <div className="signal-status">✅ Signal Loaded</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Render Content Based on Active Tab */}
        {renderContent()}
      </div>
    </div>
  );
};

export default GenericMode;