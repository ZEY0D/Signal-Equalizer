import React, { useState, useEffect, useRef } from "react";
import SliderController from "../SliderController";
import { useAudio } from "../../contexts/AudioContext";
import "./GenericMode.css";

const GenericMode = () => {
  const {
    addSlider,
    updateSlider,
    removeSlider,
    clearAllSliders,
    inputSignal,
    outputSignal,
    isProcessing,
    loadSyntheticSignal,
    stopAudio,
  } = useAudio();

  // Slider management
  const [sliders, setSliders] = useState([]);
  const [selectedBand, setSelectedBand] = useState(null);
  const [processingMode, setProcessingMode] = useState("cascading"); // "cascading" or "parallel"

  // Waveform canvas and selection
  const canvasRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Audio playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingRegion, setIsPlayingRegion] = useState(false);
  const audioSourceRef = useRef(null);

  // Region data for gain preview
  const [currentSelection, setCurrentSelection] = useState(null);

  // Load synthetic signal on mount
  useEffect(() => {
    if (!inputSignal) {
      loadSyntheticSignal();
    }
  }, [inputSignal, loadSyntheticSignal]);

  // Draw waveform whenever dependencies change
  useEffect(() => {
    drawWaveform();
  }, [inputSignal, sliders, selection, selectedBand]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }
    };
  }, []);

  // Store region data per band
  const bandRegionsRef = useRef(new Map());

  // ===========================================
  // SLIDER MANAGEMENT
  // ===========================================

  const handleAddSlider = (sliderData = {}) => {
    const newSlider = addSlider(sliderData);
    setSliders((prev) => [...prev, newSlider]);
    return newSlider;
  };

  const handleUpdateSlider = (sliderId, updates) => {
    updateSlider(sliderId, updates);
    setSliders((prev) =>
      prev.map((slider) =>
        slider.id === sliderId ? { ...slider, ...updates } : slider
      )
    );

    if (selectedBand && selectedBand.id === sliderId) {
      setSelectedBand({ ...selectedBand, ...updates });
    }
  };

  const handleRemoveSlider = (sliderId) => {
    removeSlider(sliderId);
    setSliders((prev) => prev.filter((slider) => slider.id !== sliderId));

    // Remove region data for this band
    bandRegionsRef.current.delete(sliderId);

    if (selectedBand && selectedBand.id === sliderId) {
      setSelectedBand(null);
      setCurrentSelection(null);
    }
  };

  const handleClearAllSliders = () => {
    clearAllSliders();
    setSliders([]);
    setSelectedBand(null);
    setCurrentSelection(null);
    bandRegionsRef.current.clear();
  };

  const handleSelectBand = (band) => {
    setSelectedBand(band);
    // Restore the region for this band if it exists
    const savedRegion = bandRegionsRef.current.get(band.id);
    if (savedRegion) {
      setCurrentSelection(savedRegion);
      console.log("✅ Restored region for band:", band.label);
    } else {
      setCurrentSelection(null);
      console.log("⚠️ No saved region for band:", band.label);
    }
  };

  // ===========================================
  // WAVEFORM DRAWING
  // ===========================================

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !inputSignal) return;

    const ctx = canvas.getContext("2d");
    const width = 800;
    const height = 200;
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
      const y = height / 2 - value * 80;

      if (i === 0) {
        ctx.moveTo(i, y);
      } else {
        ctx.lineTo(i, y);
      }
    }
    ctx.stroke();

    // Draw frequency bands
    sliders.forEach((slider) => {
      const startFreq = Math.max(20, slider.centerFreq - slider.width / 2);
      const endFreq = Math.min(20000, slider.centerFreq + slider.width / 2);
      const startX = (startFreq / 20000) * width;
      const endX = (endFreq / 20000) * width;

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
      if (slider === selectedBand) {
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

    // Draw current selection
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
  };

  // ===========================================
  // WAVEFORM INTERACTION
  // ===========================================

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
    const boundedX = Math.max(0, Math.min(800, x));

    setSelection({
      start: Math.min(selection.start, boundedX),
      end: Math.max(selection.start, boundedX),
      width: Math.abs(boundedX - selection.start),
    });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selection || selection.width < 10 || !inputSignal) {
      setIsSelecting(false);
      return;
    }
    setIsSelecting(false);
  };

  const handleMouseLeave = () => {
    if (isSelecting) {
      setIsSelecting(false);
    }
  };

  const clearSelection = () => {
    setSelection(null);
    setIsSelecting(false);
  };

  const createBandFromSelection = () => {
    if (!selection || !inputSignal) {
      console.log("❌ Cannot create band: no selection or signal");
      return;
    }

    console.log("🎛️ Creating band from selection:", selection);

    // Calculate frequency information
    const startFreq = (selection.start / 800) * 20000;
    const endFreq = (selection.end / 800) * 20000;
    const centerFreq = (startFreq + endFreq) / 2;
    const bandwidth = endFreq - startFreq;

    // Calculate sample indices for accurate audio playback
    const totalSamples = inputSignal.length;
    const startSample = Math.floor((selection.start / 800) * totalSamples);
    const endSample = Math.floor((selection.end / 800) * totalSamples);

    // Create validated selection object with all necessary data
    const validatedSelection = {
      start: Math.max(0, selection.start),
      end: Math.min(800, selection.end),
      width: Math.abs(selection.end - selection.start),
      startFreq: startFreq,
      endFreq: endFreq,
      centerFreq: centerFreq,
      startSample: startSample,
      endSample: endSample,
      sampleRate: inputSignal.sampleRate,
    };

    // Create new slider/band
    const newSlider = handleAddSlider({
      centerFreq: Math.max(20, Math.min(20000, centerFreq)),
      width: Math.max(50, Math.min(5000, bandwidth)),
      gain: 1.0,
      label: `${Math.round(centerFreq)}Hz Band`,
    });

    // Save region data for this specific band
    bandRegionsRef.current.set(newSlider.id, validatedSelection);

    // Save selection data and set as active band
    setCurrentSelection(validatedSelection);
    setSelectedBand(newSlider);

    console.log("✅ Band created successfully!");
    console.log("New Band:", newSlider);
    console.log("Selection Saved:", validatedSelection);

    // Clear visual selection after a brief delay
    setTimeout(() => {
      setSelection(null);
      console.log("✅ Ready for gain testing");
    }, 100);
  };

  // ===========================================
  // AUDIO PLAYBACK
  // ===========================================

  const playFullAudio = async () => {
    if (!inputSignal) {
      console.log("❌ No signal to play");
      return;
    }

    if (isPlaying) {
      // Stop current playback
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
          audioSourceRef.current = null;
        } catch (e) {
          console.log("Already stopped");
        }
      }
      setIsPlaying(false);
      return;
    }

    try {
      console.log("🎵 Processing full audio with sequential EQ...");
      setIsProcessing(true);

      // Apply sequential processing to full signal
      const processedBuffer = await applySequentialEQ(inputSignal, sliders);

      setIsProcessing(false);

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      audioContext.resume().then(() => {
        const source = audioContext.createBufferSource();
        source.buffer = processedBuffer;
        source.connect(audioContext.destination);

        source.start();
        audioSourceRef.current = source;
        setIsPlaying(true);

        source.onended = () => {
          setIsPlaying(false);
          audioSourceRef.current = null;
          audioContext.close();
        };

        console.log("🎵 Playing fully processed audio with all bands applied");
      });
    } catch (error) {
      console.error("❌ Error playing audio:", error);
      setIsPlaying(false);
      setIsProcessing(false);
    }
  };

  const playSelectedRegion = (useGain = false, gainValue = 1.0) => {
    const selectionToUse = currentSelection || selection;

    if (!selectionToUse || !inputSignal) {
      console.log("❌ No selection or input signal");
      alert("❌ Please select a region first");
      return;
    }

    console.log(`🎧 Playing region with gain: ${gainValue}x`);

    // Use pre-calculated sample indices if available
    let startSample, endSample;
    if (
      selectionToUse.startSample !== undefined &&
      selectionToUse.endSample !== undefined
    ) {
      startSample = selectionToUse.startSample;
      endSample = selectionToUse.endSample;
      console.log("✅ Using pre-calculated sample indices");
    } else {
      const totalSamples = inputSignal.length;
      startSample = Math.floor((selectionToUse.start / 800) * totalSamples);
      endSample = Math.floor((selectionToUse.end / 800) * totalSamples);
      console.log("⚠️ Calculating sample indices on-the-fly");
    }

    const segmentLength = endSample - startSample;

    if (segmentLength <= 0) {
      console.log("❌ Invalid segment length");
      alert("❌ Invalid audio segment");
      return;
    }

    try {
      // Stop any current playback
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const channelData = inputSignal.getChannelData(0);
      const audioData = new Float32Array(segmentLength);

      console.log(`📥 Copying ${segmentLength} samples...`);

      // Copy and apply gain if needed
      for (let i = 0; i < segmentLength; i++) {
        const sourceIndex = startSample + i;
        if (sourceIndex < channelData.length) {
          if (useGain && gainValue !== 1.0) {
            audioData[i] = Math.max(
              -1.0,
              Math.min(1.0, channelData[sourceIndex] * gainValue)
            );
          } else {
            audioData[i] = channelData[sourceIndex];
          }
        }
      }

      // Create buffer
      const segmentBuffer = audioContext.createBuffer(
        1,
        segmentLength,
        inputSignal.sampleRate
      );
      segmentBuffer.getChannelData(0).set(audioData);

      console.log("✅ Segment buffer created, starting playback...");

      // Resume context and play
      audioContext
        .resume()
        .then(() => {
          const source = audioContext.createBufferSource();
          source.buffer = segmentBuffer;
          source.connect(audioContext.destination);

          source.start();
          audioSourceRef.current = source;
          setIsPlayingRegion(true);

          source.onended = () => {
            console.log("✅ Playback finished");
            setIsPlayingRegion(false);
            audioSourceRef.current = null;
            audioContext.close();
          };

          console.log(
            `🎵 Playing ${(segmentLength / inputSignal.sampleRate).toFixed(
              2
            )}s segment with gain ${gainValue}x`
          );
        })
        .catch((error) => {
          console.error("❌ Error resuming audio context:", error);
          setIsPlayingRegion(false);
        });
    } catch (error) {
      console.error("❌ Error playing audio segment:", error);
      setIsPlayingRegion(false);
      alert("❌ Error playing audio. Check console for details.");
    }
  };

  const handleBandPreview = (gain) => {
    console.log("🎧 handleBandPreview called with gain:", gain);
    console.log("📊 currentSelection:", currentSelection);
    console.log("📊 selectedBand:", selectedBand);

    if (!inputSignal) {
      console.log("❌ No inputSignal");
      alert("❌ Audio signal not loaded yet. Please wait...");
      return;
    }

    if (!currentSelection) {
      console.log("❌ No currentSelection");
      alert(
        "🎵 No region selected for this band!\n\n" +
          "To test gain effects:\n" +
          "1. Click and drag on the waveform to select a region\n" +
          "2. Click 'Create Frequency Band'\n" +
          "3. Adjust the gain slider\n" +
          "4. Click the speaker icon (🔊) to preview"
      );
      return;
    }

    // Verify selection has required data
    if (!currentSelection.startSample || !currentSelection.endSample) {
      console.log("❌ Invalid currentSelection - missing sample data");
      alert(
        "❌ Selected region data is incomplete. Please select a new region."
      );
      setCurrentSelection(null);
      return;
    }

    console.log(`✅ Playing region with gain ${gain}x`);
    playSelectedRegion(true, gain);
  };

  // ===========================================
  // UI ACTIONS
  // ===========================================

  const handleAddNewBand = () => {
    const suggestedFreq =
      sliders.length === 0
        ? 1000
        : Math.max(...sliders.map((s) => s.centerFreq)) + 1000;

    const newSlider = handleAddSlider({
      centerFreq: Math.min(suggestedFreq, 18000),
      width: suggestedFreq < 2000 ? 800 : 1500,
      gain: 1.0,
      label: `Band ${sliders.length + 1}`,
    });
    setSelectedBand(newSlider);
    setCurrentSelection(null); // New manual band has no region
  };

  const handleResetAllGains = () => {
    sliders.forEach((slider) => {
      handleUpdateSlider(slider.id, { gain: 1.0 });
    });
    if (selectedBand) {
      setSelectedBand({ ...selectedBand, gain: 1.0 });
    }
  };

  const handleSaveSettings = () => {
    const settings = {
      mode: "generic",
      sliders: sliders.map((slider) => ({
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

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equalizer-settings-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ===========================================
  // RENDER
  // ===========================================

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

            <div className="header-controls">
              <div className="control-buttons">
                <button
                  onClick={() => playSelectedRegion(false)}
                  disabled={!currentSelection || isPlayingRegion}
                  className={`play-region-btn ${
                    currentSelection && !isPlayingRegion ? "active" : "disabled"
                  }`}
                  title="Play selected region without gain"
                >
                  <span className="btn-icon">▶️</span>
                  Play Region
                </button>

                <button
                  onClick={playFullAudio}
                  className={`play-full-btn ${isPlaying ? "stop" : "play"}`}
                  title={isPlaying ? "Stop playback" : "Play full audio"}
                >
                  <span className="btn-icon">{isPlaying ? "⏹️" : "🎵"}</span>
                  {isPlaying ? "Stop" : "Play Full"}
                </button>
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

        <div className="main-content">
          {/* Left Panel - Waveform and Bands */}
          <div className="left-panel">
            {/* Waveform */}
            <div className="waveform-container">
              <div className="section-header">
                <h2 className="section-title">
                  {outputSignal ? "🎧 Processed Signal" : "🎵 Original Signal"}
                </h2>
                {inputSignal && (
                  <div className="signal-info">
                    <span className="duration">
                      {inputSignal.duration?.toFixed(2)}s
                    </span>
                    <span className="sample-rate">
                      {inputSignal.sampleRate}Hz
                    </span>
                    {currentSelection && (
                      <span className="region-saved">🎯 Region Saved</span>
                    )}
                  </div>
                )}
              </div>

              <div className="waveform-wrapper">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={200}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  className="waveform"
                />

                {selection && selection.width > 5 && (
                  <div className="selection-popup">
                    <div className="popup-header">
                      <div className="popup-title">
                        <div className="pulse-dot"></div>
                        Region Selected
                      </div>
                      <button onClick={clearSelection} className="close-popup">
                        ✕
                      </button>
                    </div>

                    <div className="popup-info">
                      <div className="info-item">
                        <span className="info-label">Width</span>
                        <span className="info-value">
                          {selection.width.toFixed(0)}px
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Frequencies</span>
                        <span className="info-value">
                          {Math.round((selection.start / 800) * 20000)} -{" "}
                          {Math.round((selection.end / 800) * 20000)} Hz
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={createBandFromSelection}
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
                {currentSelection && selectedBand && (
                  <div className="success-text">
                    <div>✅ Region saved for {selectedBand.label}</div>
                    <div className="text-xs mt-1 opacity-75">
                      {currentSelection.startSample} -{" "}
                      {currentSelection.endSample} samples (
                      {(
                        (currentSelection.endSample -
                          currentSelection.startSample) /
                        currentSelection.sampleRate
                      ).toFixed(3)}
                      s)
                    </div>
                  </div>
                )}
                {selectedBand && !currentSelection && (
                  <p className="warning-text">
                    ⚠️ No region selected for this band - select a region to
                    test gain effects
                  </p>
                )}
              </div>
            </div>

            {/* Bands List */}
            <div className="bands-container">
              <div className="section-header">
                <h2 className="section-title">
                  Frequency Bands{" "}
                  <span className="count-badge">{sliders.length}</span>
                </h2>
                <div className="header-actions">
                  <button
                    onClick={handleClearAllSliders}
                    className="clear-all-btn"
                    disabled={sliders.length === 0}
                  >
                    <span className="btn-icon">🗑️</span>
                    Clear All
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    className="save-settings-btn"
                    disabled={sliders.length === 0}
                  >
                    <span className="btn-icon">💾</span>
                    Save Settings
                  </button>
                </div>
              </div>

              <div className="bands-grid">
                {sliders.map((slider) => {
                  const hasRegion = bandRegionsRef.current.has(slider.id);
                  return (
                    <div
                      key={slider.id}
                      onClick={() => handleSelectBand(slider)}
                      className={`band-card ${
                        selectedBand?.id === slider.id ? "selected" : ""
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

              {sliders.length === 0 && (
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
              {selectedBand ? (
                <>
                  <div className="controls-header">
                    <h2 className="controls-title">
                      Editing:{" "}
                      <span className="band-name">{selectedBand.label}</span>
                    </h2>
                    <div className="controls-actions">
                      {currentSelection && (
                        <span className="region-ready-badge">
                          🎯 Region Ready
                        </span>
                      )}
                      <button
                        onClick={() => setSelectedBand(null)}
                        className="close-controls"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <SliderController
                    slider={selectedBand}
                    onUpdate={(updates) =>
                      handleUpdateSlider(selectedBand.id, updates)
                    }
                    onRemove={() => handleRemoveSlider(selectedBand.id)}
                    onPreview={currentSelection ? handleBandPreview : null}
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
                    onClick={handleAddNewBand}
                    className="action-btn add-band"
                  >
                    <span className="btn-icon">➕</span>
                    Add Band
                  </button>
                  <button
                    onClick={handleResetAllGains}
                    className="action-btn reset-gains"
                    disabled={sliders.length === 0}
                  >
                    <span className="btn-icon">⚖️</span>
                    Reset Gains
                  </button>
                  <button
                    onClick={handleClearAllSliders}
                    className="action-btn clear-all"
                    disabled={sliders.length === 0}
                  >
                    <span className="btn-icon">🗑️</span>
                    Clear All
                  </button>
                </div>
                {currentSelection && (
                  <div className="preview-hint">
                    💡 Click the 🔊 speaker icon in the gain control to test
                    effects on your selected region
                  </div>
                )}
                {!currentSelection && selectedBand && (
                  <div className="preview-hint warning">
                    ⚠️ Select a waveform region first to enable gain preview for
                    this band
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenericMode;
