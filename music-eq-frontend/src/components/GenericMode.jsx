import { useState, useRef, useEffect, useCallback } from "react"
import { 
  Button, 
  Card, 
  Label, 
  Slider, 
  Switch, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue, 
  ToggleGroup, 
  ToggleGroupItem 
} from "../components-generic/ui"
import { Play, Pause, Square, FileUp, ZoomIn, ZoomOut, RefreshCw, Loader2 } from "lucide-react"
import { useSignalProcessor } from "../hooks/useSignalProcessor"
import * as api from "../services/api"
import { healthCheck } from "../services/api"
import { SliderManager, FrequencyGraph, SignalViewer } from "../components-generic"
import Spectrogram from "../components-generic/Spectrogram"

export default function GenericMode() {
  const [speed, setSpeed] = useState([1])
  const [showSpectrograms, setShowSpectrograms] = useState(true)
  const [showSliderOverlays, setShowSliderOverlays] = useState(true)
  const [backendStatus, setBackendStatus] = useState("checking")
  const [autoProcess, setAutoProcess] = useState(false)
  const [frequencyScale, setFrequencyScale] = useState("linear")
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSource, setPlaybackSource] = useState("input") // 'input' or 'output'
  const [zoomLevel, setZoomLevel] = useState(1) // Synchronized zoom for both viewers
  const [viewReset, setViewReset] = useState(0) // Trigger to reset views
  const [playbackProgress, setPlaybackProgress] = useState(0) // Current playback position in seconds
  const fileInputRef = useRef(null)
  const processTimerRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioSourceRef = useRef(null)
  const playbackStartTimeRef = useRef(null)
  const animationFrameRef = useRef(null)
  
  // Ref to store latest slider values (prevents stale state in callbacks)
  const latestSlidersRef = useRef([])
  
  // Cache full signal data for audio playback (not downsampled)
  const fullInputSignalRef = useRef(null)
  const fullOutputSignalRef = useRef(null)
  const inputCachedRef = useRef(false)
  const outputCachedRef = useRef(false)

  // Use our custom hook for signal processing
  const {
    sessionId,
    isLoading,
    error,
    signalInfo,
    inputSignal,
    outputSignal,
    fftData,
    sliders,
    uploadFile,
    createSynthetic,
    processSignal,
    addSlider,
    updateSlider,
    removeSlider,
    reset,
    saveConfiguration,
    loadConfiguration,
    listConfigurations,
  } = useSignalProcessor()
  
  // State for output FFT (to show frequency spectrum of processed signal)
  const [outputFFT, setOutputFFT] = useState(null)
  
  // State for spectrograms
  const [inputSpectrogram, setInputSpectrogram] = useState(null)
  const [outputSpectrogram, setOutputSpectrogram] = useState(null)

  // Sync latestSlidersRef with sliders state (prevents stale closure)
  useEffect(() => {
    latestSlidersRef.current = sliders
  }, [sliders])

  // Debug: Track outputSignal changes
  useEffect(() => {
    if (outputSignal) {
      console.log('🔄 App: outputSignal state updated:', {
        length: outputSignal.signal?.length || 'N/A',
        maxAmplitude: outputSignal.signal ? Math.max(...outputSignal.signal.map(Math.abs)) : 'N/A',
        hasTimeAxis: !!outputSignal.time_axis
      });
    } else {
      console.log('🔄 App: outputSignal is null');
    }
  }, [outputSignal]);

  // Check backend connection on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await healthCheck()
        setBackendStatus("connected")
      } catch (error) {
        setBackendStatus("error")
        console.error("Backend connection failed:", error)
      }
    }
    checkBackend()
  }, [])

  // Handle file upload
  const handleFileUpload = async (event) => {
    event.preventDefault()
    const file = event.target.files?.[0]
    if (!file) return

    try {
      await uploadFile(file)
      console.log("File uploaded successfully")
    } catch (error) {
      console.error("Upload failed:", error)
    }
  }

  // Handle synthetic signal creation - 20 seconds with time-segmented frequencies
  const handleCreateSynthetic = async () => {
    try {
      // 20-second test signal divided into 5 segments of 4 seconds each:
      // 0-4s:   100 Hz (Low rumble - should be barely audible)
      // 4-8s:   500 Hz (Deep bass tone)
      // 8-12s:  1000 Hz (Mid-range tone - most prominent)
      // 12-16s: 2000 Hz (High mid tone)
      // 16-20s: 4000 Hz (High frequency tone)
      // Each segment is pure for surgical testing
      await createSynthetic({
        frequencies: [100, 500, 1000, 2000, 4000],
        duration: 20.0,
        sample_rate: 44100,
      })
      console.log("20-second segmented synthetic signal created")
      alert("Test Signal Created!\n\n" +
            "Time Segments:\n" +
            "0-4s:   100 Hz (Low rumble)\n" +
            "4-8s:   500 Hz (Bass tone)\n" +
            "8-12s:  1000 Hz (Mid tone - loudest)\n" +
            "12-16s: 2000 Hz (High mid)\n" +
            "16-20s: 4000 Hz (High tone)\n\n" +
            "Listen to each segment and observe the frequency graph!")
    } catch (error) {
      console.error("Failed to create synthetic signal:", error)
    }
  }

  // Handle process with debouncing
  const handleProcess = useCallback(async () => {
    if (!sessionId || latestSlidersRef.current.length === 0) return
    
    try {
      // Clear output signal cache since it will change
      fullOutputSignalRef.current = null
      outputCachedRef.current = false
      
      // Use latestSlidersRef.current to avoid stale state
      await processSignal(latestSlidersRef.current)
      // Fetch output FFT to show processed frequency spectrum
      try {
        const outputFftData = await api.getOutputFFT(sessionId)
        setOutputFFT(outputFftData)
        console.log('✓ Output FFT fetched for comparison')
      } catch (err) {
        console.warn('Could not fetch output FFT:', err.message)
      }
      
      // Fetch output spectrogram if spectrograms are enabled
      if (showSpectrograms) {
        try {
          const outputSpectData = await api.getOutputSpectrogram(sessionId)
          setOutputSpectrogram(outputSpectData)
          console.log('✓ Output spectrogram fetched')
        } catch (err) {
          console.warn('Could not fetch output spectrogram:', err.message)
        }
      }
    } catch (error) {
      console.error("Processing failed:", error)
    }
  }, [sessionId, processSignal, showSpectrograms])

  // Debounced auto-process function
  const triggerAutoProcess = useCallback(() => {
    if (!autoProcess || !sessionId) return
    
    // Clear existing timer
    if (processTimerRef.current) {
      clearTimeout(processTimerRef.current)
    }
    
    // Set new timer for 500ms debounce
    processTimerRef.current = setTimeout(() => {
      handleProcess()
    }, 500)
  }, [autoProcess, sessionId, handleProcess])

  // Handle slider addition
  const handleAddSlider = (preset = null) => {
    if (preset) {
      addSlider(preset)
    } else {
      addSlider({
        center_freq: 1000,
        width: 200,
        gain: 1.0,
      })
    }
    // Trigger auto-process after adding
    setTimeout(() => triggerAutoProcess(), 100)
  }
  
  // Wrapped updateSlider (no auto-trigger, manual Apply Changes required)
  const handleUpdateSlider = useCallback((id, updates) => {
    const updatedSliders = updateSlider(id, updates)
    // Update ref immediately with latest values (prevents stale state)
    latestSlidersRef.current = updatedSliders
    // Only trigger auto-process if explicitly enabled
    if (autoProcess) {
      triggerAutoProcess()
    }
  }, [updateSlider, triggerAutoProcess, autoProcess])
  
  // Wrapped removeSlider (no auto-trigger, manual Apply Changes required)
  const handleRemoveSlider = useCallback((id) => {
    removeSlider(id)
    // Only trigger auto-process if explicitly enabled
    if (autoProcess) {
      triggerAutoProcess()
    }
  }, [removeSlider, triggerAutoProcess, autoProcess])

  // Handle reset
  const handleReset = async () => {
    try {
      // Clear cached signals
      fullInputSignalRef.current = null
      fullOutputSignalRef.current = null
      inputCachedRef.current = false
      outputCachedRef.current = false
      
      await reset()
      // Clear any pending auto-process
      if (processTimerRef.current) {
        clearTimeout(processTimerRef.current)
      }
    } catch (error) {
      console.error("Reset failed:", error)
    }
  }
  
  // Audio playback functions
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioContextRef.current
  }

  const handlePlay = async (source = playbackSource) => {
    if (!sessionId) return
    
    // Check if output signal exists when trying to play output
    if (source === 'output' && !outputSignal) {
      alert('No output signal available. Please add sliders and click "Apply Processing" first.')
      return
    }
    
    const audioCtx = initAudioContext()
    
    // Stop any existing playback
    if (audioSourceRef.current) {
      audioSourceRef.current.stop()
    }

    // Set playing state immediately for responsive UI
    setIsPlaying(true)
    setPlaybackSource(source)

    try {
      // ALWAYS fetch fresh output signal to ensure we have the latest processed data
      // Input can use cache since it never changes
      let fullSignalData
      
      if (source === 'input' && fullInputSignalRef.current) {
        console.log('🎵 Using cached input signal (instant playback)')
        fullSignalData = fullInputSignalRef.current
      } else if (source === 'input') {
        console.log('🎵 Fetching input audio data for playback...')
        fullSignalData = await api.getInputSignal(sessionId, 999999999, true)
        fullInputSignalRef.current = fullSignalData
      } else {
        // For output, always fetch fresh to get latest processing
        console.log('🎵 Fetching output audio data for playback (latest processed version)...')
        fullSignalData = await api.getOutputSignal(sessionId, 999999999, true)
        fullOutputSignalRef.current = fullSignalData
        outputCachedRef.current = true
        console.log('✓ Fresh output signal loaded for playback')
      }
      
      const signalData = fullSignalData.signal
      const sampleRate = fullSignalData.sample_rate || signalInfo?.sample_rate || 44100
      
      console.log('🎵 Audio Playback:')
      console.log('  Source:', source)
      console.log('  Signal length:', signalData.length, 'samples')
      console.log('  Sample rate:', sampleRate, 'Hz')
      console.log('  Duration:', (signalData.length / sampleRate).toFixed(2), 'seconds')
      console.log('  Speed:', speed[0] + 'x')

      // Create audio buffer
      const buffer = audioCtx.createBuffer(1, signalData.length, sampleRate)
      const channelData = buffer.getChannelData(0)
      
      // Copy signal data to buffer
      for (let i = 0; i < signalData.length; i++) {
        channelData[i] = signalData[i]
      }

      // Create and configure source
      const source_node = audioCtx.createBufferSource()
      source_node.buffer = buffer
      source_node.playbackRate.value = speed[0]
      source_node.connect(audioCtx.destination)
      
      source_node.onended = () => {
        setIsPlaying(false)
        audioSourceRef.current = null
      }
      
      // Start playback immediately
      source_node.start()
      audioSourceRef.current = source_node
      playbackStartTimeRef.current = audioCtx.currentTime
      
      // Start progress animation
      const duration = signalData.length / sampleRate
      let lastUpdate = 0
      const updateProgress = () => {
        if (audioSourceRef.current && audioCtx) {
          const elapsed = audioCtx.currentTime - playbackStartTimeRef.current
          const progress = Math.min(elapsed * speed[0], duration)
          
          // Throttle updates to ~30 FPS to avoid excessive re-renders
          const now = performance.now()
          if (now - lastUpdate > 33) {
            setPlaybackProgress(progress)
            lastUpdate = now
          }
          
          if (progress < duration) {
            animationFrameRef.current = requestAnimationFrame(updateProgress)
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(updateProgress)
      
      console.log('✓ Audio playback started')
    } catch (error) {
      console.error('Audio playback failed:', error)
      setIsPlaying(false)
      setPlaybackProgress(0)
      alert('Failed to play audio: ' + error.message)
    }
  }

  const handlePause = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop()
      audioSourceRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setIsPlaying(false)
  }

  const handleStop = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop()
      audioSourceRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setIsPlaying(false)
    setPlaybackProgress(0)
  }

  // Synchronized zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newLevel = Math.min(prev * 1.5, 10)
      return newLevel
    })
  }

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newLevel = Math.max(prev / 1.5, 0.1)
      return newLevel
    })
  }

  const handleResetView = () => {
    setZoomLevel(1)
    setViewReset(prev => prev + 1) // Trigger reset in charts
  }

  // Update playback speed in real-time
  useEffect(() => {
    if (audioSourceRef.current && audioSourceRef.current.playbackRate) {
      audioSourceRef.current.playbackRate.value = speed[0]
    }
  }, [speed])

  // Pre-fetch and cache full signal data for instant playback
  useEffect(() => {
    const cacheFullSignals = async () => {
      if (!sessionId) return
      
      // Cache input signal for instant playback (only once)
      if (inputSignal && !inputCachedRef.current) {
        try {
          console.log('📦 Caching full input signal for instant playback...')
          const fullData = await api.getInputSignal(sessionId, 999999999, true)
          fullInputSignalRef.current = fullData
          inputCachedRef.current = true
          console.log('✓ Input signal cached')
        } catch (err) {
          console.warn('Could not cache input signal:', err.message)
        }
      }
      
      // Cache output signal for instant playback (only once per processing)
      if (outputSignal && !outputCachedRef.current) {
        try {
          console.log('📦 Caching full output signal for instant playback...')
          const fullData = await api.getOutputSignal(sessionId, 999999999, true)
          fullOutputSignalRef.current = fullData
          outputCachedRef.current = true
          console.log('✓ Output signal cached')
        } catch (err) {
          console.warn('Could not cache output signal:', err.message)
        }
      }
    }
    
    cacheFullSignals()
  }, [sessionId, inputSignal, outputSignal])

  // Fetch input spectrogram when signal is loaded
  useEffect(() => {
    const fetchInputSpectrogram = async () => {
      if (!sessionId || !inputSignal || !showSpectrograms) return
      
      try {
        const inputSpectData = await api.getInputSpectrogram(sessionId)
        setInputSpectrogram(inputSpectData)
        console.log('✓ Input spectrogram fetched')
      } catch (err) {
        console.warn('Could not fetch input spectrogram:', err.message)
      }
    }
    
    fetchInputSpectrogram()
  }, [sessionId, inputSignal, showSpectrograms])

  // Cleanup timer and audio on unmount
  useEffect(() => {
    return () => {
      if (processTimerRef.current) {
        clearTimeout(processTimerRef.current)
      }
      if (audioSourceRef.current) {
        audioSourceRef.current.stop()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Calculate max frequency based on signal info
  const maxFrequency = signalInfo ? signalInfo.sample_rate / 2 : 22050

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card p-4 sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-full px-2">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">Signal Equalizer</h1>
            {/* Backend Status Indicator */}
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                backendStatus === "connected" ? "bg-green-500" : 
                backendStatus === "error" ? "bg-red-500" : 
                "bg-yellow-500 animate-pulse"
              }`} />
              <span className="text-muted-foreground">
                {backendStatus === "connected" ? "Backend Connected" : 
                 backendStatus === "error" ? "Backend Offline" : 
                 "Checking..."}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Open File...
            </Button>
            <Button 
              variant="outline"
              onClick={handleCreateSynthetic}
              disabled={isLoading}
            >
              Create Test Signal
            </Button>
          </div>
        </div>
        {/* Signal Info Bar */}
        {signalInfo && (
          <div className="mt-3 px-2 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground flex items-center gap-4">
            <span className="font-medium">{signalInfo.filename}</span>
            <span>•</span>
            <span>{signalInfo.sample_rate} Hz</span>
            <span>•</span>
            <span>{signalInfo.duration.toFixed(2)}s</span>
            <span>•</span>
            <span>{signalInfo.length.toLocaleString()} samples</span>
            {sessionId && (
              <>
                <span>•</span>
                <span className="font-mono text-xs">Session: {sessionId.slice(0, 8)}</span>
              </>
            )}
          </div>
        )}
        {/* Error Display */}
        {error && (
          <div className="mt-3 px-2 py-2 bg-red-500/10 border border-red-500/20 rounded-md text-sm text-red-600">
            Error: {error}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex gap-6 max-w-full">
          {/* Left Column - Main Content (~70%) */}
          <div className="flex-[70] space-y-6 min-w-0">
            {/* Playback & View Controls */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Playback & View Controls</h2>
              <div className="flex flex-wrap items-center gap-4">
                {/* Global Playback Controls */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    title="Pause" 
                    disabled={!isPlaying}
                    onClick={handlePause}
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    title="Stop All" 
                    disabled={!isPlaying}
                    onClick={handleStop}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </div>

                <div className="h-6 border-r border-border"></div>

                {/* Speed Control */}
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <Label htmlFor="speed" className="whitespace-nowrap text-sm">
                    Speed
                  </Label>
                  <Slider
                    id="speed"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={speed}
                    onValueChange={setSpeed}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-10 text-right">{speed[0].toFixed(1)}x</span>
                </div>

                <div className="h-6 border-r border-border"></div>

                {/* View Controls */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    title="Zoom In (works during playback)"
                    onClick={handleZoomIn}
                    disabled={!inputSignal && !outputSignal}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline"
                    size="icon" 
                    title="Zoom Out (works during playback)"
                    onClick={handleZoomOut}
                    disabled={!inputSignal && !outputSignal}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    className="px-3 bg-transparent"
                    title="Reset View (works during playback)"
                    onClick={handleResetView}
                    disabled={!inputSignal && !outputSignal}
                  >
                    Reset View
                  </Button>
                  <Button 
                    variant="outline" 
                    className="px-3 bg-transparent gap-2"
                    onClick={handleReset}
                    disabled={!sessionId || isLoading}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reset Signal
                  </Button>
                </div>
              </div>
            </Card>

            {/* Input Signal */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Input Signal (Time-Domain)</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={!inputSignal}
                  onClick={() => handlePlay('input')}
                  className="gap-2"
                >
                  <Play className="h-3 w-3" />
                  Play Input
                </Button>
              </div>
              <SignalViewer
                signalData={inputSignal}
                title=""
                color="rgb(34, 197, 94)"
                height={250}
                sampleRate={signalInfo?.sample_rate || 44100}
                zoomLevel={zoomLevel}
                resetTrigger={viewReset}
                syncId="signal-sync"
                onZoomChange={setZoomLevel}
                playbackProgress={playbackSource === 'input' ? playbackProgress : 0}
                isPlaying={isPlaying && playbackSource === 'input'}
              />
            </Card>

            {/* Input Spectrogram */}
            {showSpectrograms && (
              <Card className="p-6">
                <h3 className="text-sm font-semibold mb-3 text-green-600 dark:text-green-400">Input Spectrogram</h3>
                <Spectrogram
                  spectrogramData={inputSpectrogram}
                  title=""
                  height={300}
                  maxFreq={5000}
                />
              </Card>
            )}

            {/* Output Signal */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Output Signal (Time-Domain)</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={!outputSignal}
                  onClick={() => handlePlay('output')}
                  className="gap-2"
                >
                  <Play className="h-3 w-3" />
                  Play Output
                </Button>
              </div>
              <SignalViewer
                signalData={outputSignal}
                title=""
                color="rgb(239, 68, 68)"
                height={250}
                sampleRate={signalInfo?.sample_rate || 44100}
                zoomLevel={zoomLevel}
                resetTrigger={viewReset}
                syncId="signal-sync"
                onZoomChange={setZoomLevel}
                playbackProgress={playbackSource === 'output' ? playbackProgress : 0}
                isPlaying={isPlaying && playbackSource === 'output'}
              />
            </Card>

            {/* Output Spectrogram */}
            {showSpectrograms && (
              <Card className="p-6">
                <h3 className="text-sm font-semibold mb-3 text-red-600 dark:text-red-400">Output Spectrogram</h3>
                <Spectrogram
                  spectrogramData={outputSpectrogram}
                  title=""
                  height={300}
                  maxFreq={5000}
                />
              </Card>
            )}

            {/* Input vs Output Frequency Comparison */}
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold mb-2">📊 Input vs Output Comparison</h2>
                <p className="text-xs text-muted-foreground mb-3">
                  <span className="text-green-600 dark:text-green-400">Green = Input (original)</span> • 
                  <span className="text-red-600 dark:text-red-400 ml-2">Red = Output (processed)</span>
                  <br/>
                  Look for differences in peak heights to see the effect of your sliders
                </p>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-xs">
                  <p className="font-semibold text-yellow-700 dark:text-yellow-400">💡 How to See Changes:</p>
                  <ul className="list-disc list-inside mt-1 text-muted-foreground space-y-1">
                    <li><strong>MUTE a frequency (gain=0):</strong> Red line should drop to zero at that frequency</li>
                    <li><strong>BOOST a frequency (gain=2):</strong> Red line should be taller than green at that frequency</li>
                    <li><strong>No sliders:</strong> Red and green lines should overlap perfectly</li>
                  </ul>
                </div>
              </div>
              <div className="space-y-4">
                {/* Input FFT (Green) */}
                <div className="border border-green-500/30 rounded-md p-3">
                  <h3 className="text-sm font-medium mb-2 text-green-600 dark:text-green-400">Input Spectrum (Before)</h3>
                  <FrequencyGraph
                    fftData={fftData}
                    sliders={sliders}
                    scale={frequencyScale}
                    showSliderOverlays={showSliderOverlays}
                    height={200}
                  />
                </div>
                
                {/* Output FFT (Red) */}
                <div className="border border-red-500/30 rounded-md p-3">
                  <h3 className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">Output Spectrum (After)</h3>
                  <FrequencyGraph
                    fftData={outputFFT}
                    sliders={sliders}
                    scale={frequencyScale}
                    showSliderOverlays={showSliderOverlays}
                    height={200}
                  />
                </div>

                {/* Toggle Button for Scale */}
                <div className="flex justify-center pt-2">
                  <ToggleGroup 
                    type="single" 
                    value={frequencyScale} 
                    onValueChange={setFrequencyScale}
                    className="w-full max-w-md"
                  >
                    <ToggleGroupItem value="linear" className="flex-1" disabled={!fftData}>
                      Linear
                    </ToggleGroupItem>
                    <ToggleGroupItem value="audiogram" className="flex-1" disabled={!fftData}>
                      Audiogram
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Sidebar (~30%) */}
          <div className="flex-[30] space-y-6 min-w-0">
            {/* Real-Time Observation Guide */}
            <Card className="p-6 bg-blue-500/5 border-blue-500/20">
              <h2 className="text-lg font-semibold mb-3 text-blue-600 dark:text-blue-400">🔍 What to Observe</h2>
              <div className="space-y-3 text-sm">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">When you MUTE a frequency (gain = 0):</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                    <li><strong>Frequency Graph:</strong> The spike at that frequency should disappear or shrink dramatically</li>
                    <li><strong>Output Waveform:</strong> Amplitude may decrease if that frequency was dominant</li>
                    <li><strong>Audio:</strong> You won't hear that specific tone anymore (surgical removal!)</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">When you AMPLIFY a frequency (gain = 2):</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                    <li><strong>Frequency Graph:</strong> The spike at that frequency should grow taller</li>
                    <li><strong>Output Waveform:</strong> Overall amplitude increases, more oscillations</li>
                    <li><strong>Audio:</strong> That tone becomes louder and more prominent</li>
                  </ul>
                </div>
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                  <p className="font-semibold text-green-700 dark:text-green-400 mb-1">✅ Scientific Test:</p>
                  <p className="text-xs text-muted-foreground">
                    Create test signal → Add slider at 1000 Hz (width ~200 Hz) → Set gain to 0 → 
                    Observe: 1000 Hz disappears, but 500 Hz and 2000 Hz remain unchanged. Listen: 
                    you'll hear low and high tones, but NOT the 1000 Hz mid tone!
                  </p>
                </div>
              </div>
            </Card>

            {/* Equalizer Controls */}
            <Card className="p-6">
              {/* Auto-process toggle */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <Switch 
                    id="auto-process" 
                    checked={autoProcess} 
                    onCheckedChange={setAutoProcess}
                  />
                  <Label htmlFor="auto-process" className="text-sm cursor-pointer">
                    Auto-process on changes
                  </Label>
                  {!autoProcess && (
                    <span className="text-xs text-muted-foreground">(Manual mode - click "Apply Changes")</span>
                  )}
                </div>
                {autoProcess && (
                  <span className="text-xs text-green-600">● Live</span>
                )}
              </div>

              {/* Slider Manager Component */}
              <SliderManager
                sliders={sliders}
                maxFrequency={maxFrequency}
                onAddSlider={handleAddSlider}
                onUpdateSlider={handleUpdateSlider}
                onRemoveSlider={handleRemoveSlider}
                onProcessSignal={handleProcess}
                onReset={handleReset}
                isLoading={isLoading}
                disabled={!sessionId}
                autoProcess={autoProcess}
              />
            </Card>

            {/* Configuration Save/Load */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Configuration</h2>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Config name..."
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-background"
                    id="config-name"
                    disabled={!sessionId || sliders.length === 0}
                  />
                  <Button
                    variant="default"
                    size="sm"
                    disabled={!sessionId || sliders.length === 0 || isLoading}
                    onClick={async () => {
                      const name = document.getElementById('config-name').value
                      if (!name) {
                        alert('Please enter a configuration name')
                        return
                      }
                      try {
                        await saveConfiguration(name)
                        alert('Configuration saved successfully!')
                        document.getElementById('config-name').value = ''
                      } catch (err) {
                        console.error('Configuration save error:', err)
                        alert(`Failed to save configuration: ${err.message}\n\nTip: Check if backend is running and restart it if needed.`)
                      }
                    }}
                  >
                    Save
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  disabled={!sessionId || isLoading}
                  onClick={async () => {
                    try {
                      const configs = await listConfigurations()
                      if (configs.length === 0) {
                        alert('No saved configurations found')
                        return
                      }
                      const names = configs.map(c => c.name).join('\\n')
                      const selected = prompt(`Available configurations:\\n${names}\\n\\nEnter name to load:`)
                      if (selected) {
                        await loadConfiguration(selected)
                        alert('Configuration loaded successfully!')
                      }
                    } catch (err) {
                      alert('Failed to load configuration')
                    }
                  }}
                >
                  Load Configuration
                </Button>
              </div>
            </Card>

            {/* View Options */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">View Options</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="spectrograms" className="text-sm cursor-pointer">
                    Show/Hide Spectrograms
                  </Label>
                  <Switch id="spectrograms" checked={showSpectrograms} onCheckedChange={setShowSpectrograms} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="slider-overlays" className="text-sm cursor-pointer">
                    Show Slider Effects on Graph
                  </Label>
                  <Switch id="slider-overlays" checked={showSliderOverlays} onCheckedChange={setShowSliderOverlays} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
