# 🎵 Music Equalizer - Complete Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Complete User Flow](#complete-user-flow)
4. [Backend Deep Dive](#backend-deep-dive)
5. [Frontend Deep Dive](#frontend-deep-dive)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Code Walkthrough](#code-walkthrough)

---

## Project Overview

This is a **web-based signal equalizer** with **AI-powered source separation** capabilities. It allows users to:
- Upload audio files and visualize them (waveform, FFT, spectrogram)
- Apply custom frequency equalization using sliders
- Separate music into stems (drums, bass, vocals, piano) using **Demucs AI**
- Mix separated stems with individual volume controls
- Support for 3 modes: Music, Animals, Human voices

### Tech Stack

**Backend:**
- FastAPI (Python web framework)
- NumPy (array operations)
- Custom FFT implementation (Cooley-Tukey algorithm)
- Demucs 3.0.6 (AI source separation by Meta)
- soundfile/librosa (audio I/O)

**Frontend:**
- React 19 + Vite
- Axios (HTTP client)
- HTML5 Canvas (waveform visualization)
- Chart.js (frequency/spectrogram graphs)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React Frontend (localhost:5173)                      │  │
│  │  - Upload UI                                          │  │
│  │  - Equalizer Sliders                                  │  │
│  │  - Visualizations (Canvas + Chart.js)                 │  │
│  │  - Audio Players                                      │  │
│  └─────────────────┬─────────────────────────────────────┘  │
│                    │ HTTP/REST API                          │
│                    │ (axios calls)                          │
└────────────────────┼────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            FastAPI Backend (localhost:8000)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  API Endpoints (main.py)                              │  │
│  │  - /api/upload        (file upload)                   │  │
│  │  - /api/process       (apply EQ)                      │  │
│  │  - /api/audio/{type}  (serve audio)                   │  │
│  │  - /api/separate-demucs (AI separation)               │  │
│  │  - /api/mix-demucs-stems (mix stems)                  │  │
│  └────────────┬──────────────────────────────────────────┘  │
│               │                                              │
│  ┌────────────▼──────────────────────────────────────────┐  │
│  │  Core DSP Engine (backend/)                           │  │
│  │  - SignalProcessor (equalizer_core.py)                │  │
│  │  - FFT/IFFT (fft_implementation.py)                   │  │
│  │  - Audio I/O (signal_io.py)                           │  │
│  │  - Demucs Integration (demucs_integration.py)         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  File Storage                                          │  │
│  │  - uploads/      (uploaded audio files)               │  │
│  │  - outputs/      (processed audio, spectrograms)      │  │
│  │  - models/       (AI models cache)                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete User Flow

### Step 1: File Upload

**User Action:** User selects an audio file (.wav) and clicks upload

**Frontend (`App.jsx` lines 802-845):**

```jsx
const handleFileUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setLoading(true);
  try {
    // 1. Upload file and get session ID
    const newSessionId = await uploadFileAndStartSession(file);
    setSessionId(newSessionId);

    // 2. Set audio URLs to display the uploaded file
    const inputUrl = getAudioUrl(newSessionId, "input");
    setAudioUrlInput(inputUrl);
    setAudioUrlOutput(inputUrl); // Initially, output = input (no processing yet)

    // 3. Fetch input data for visualization
    const signalDataInput = await fetchSignalData(newSessionId, "input");
    setInputWaveform(signalDataInput.signal);
    setOutputWaveform(signalDataInput.signal); // Initially, output = input (same reference)
    
    const fftInput = await fetchFFT(newSessionId, "input");
    setInputFftData(fftInput.magnitudes);
    setOutputFftData(fftInput.magnitudes); // Initially, output = input (same reference)

    // 4. Fetch spectrograms
    try {
      const inputSpec = await axios.get(
        `${API_BASE_URL}/spectrogram/input?session_id=${newSessionId}`
      );
      setInputSpectrogramData(inputSpec.data);
      setOutputSpectrogramData(inputSpec.data); // Initially, output = input (same reference)
    } catch (err) {
      console.warn("Could not fetch spectrogram:", err);
    }

    console.log("✅ File loaded. Output = Input (no processing applied yet)");
    console.log(`   Waveform length: ${signalDataInput.signal.length}`);
    console.log(`   FFT length: ${fftInput.magnitudes.length}`);
  } catch (e) {
    console.error(
      "Failed to upload file or start session. Check console.",
      e
    );
  } finally {
    setLoading(false);
  }
};
```

**Backend (`main.py` lines 209-263):**

```python
@app.post("/api/upload", response_model=SignalInfoResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    Uploads an audio file and initializes a new session.
    Computes FFT ONCE here and stores it.
    """
    global sessions, slider_states
    
    # Create a new session
    session_id = str(uuid.uuid4())
    filename = f"{session_id}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    
    try:
        # Save uploaded file
        with open(filepath, "wb") as buffer:
            buffer.write(await file.read())
            
        # Initialize processor
        processor = SignalProcessor(filepath)
        
        # ⚡ COMPUTE FFT ONCE HERE (this is the only FFT in the entire flow)
        print(f"\n{'='*60}")
        print(f"🎵 COMPUTING FFT (ONE-TIME OPERATION)")
        print(f"   Session: {session_id}")
        processor.compute_fft()
        print(f"✓ FFT computed and cached in session")
        
        # VERIFY: Check if data and original_data are identical after upload
        if processor.data is not None and processor.original_data is not None:
            arrays_equal = np.array_equal(processor.data, processor.original_data)
            max_diff = np.max(np.abs(processor.data - processor.original_data))
            print(f"🔍 DATA INTEGRITY CHECK:")
            print(f"   processor.data == processor.original_data: {arrays_equal}")
            print(f"   Max difference: {max_diff:.2e}")
            if not arrays_equal:
                print(f"   ⚠️  WARNING: Data has been modified during upload!")
        print(f"{'='*60}\n")
        
        # Store in session
        sessions[session_id] = processor
        
        # Initialize empty slider state
        slider_states[session_id] = []
        
        # Get signal info
        info = processor.get_info()
        
        return {
            'session_id': session_id,
            'filename': file.filename,
            'sample_rate': info['sample_rate'],
            'duration': info['duration_seconds'],
            'length': info['length_samples'],
            'message': 'File uploaded and FFT computed successfully'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**What happens in SignalProcessor (`equalizer_core.py` lines 95-124):**

```python
def load_from_file(self, filepath):
    """
    Load an audio file and prepare for processing.
    
    Args:
        filepath (str): Path to audio file
    
    Raises:
        FileNotFoundError: If file doesn't exist
    """
    self.filepath = filepath
    
    # Load audio file
    data, sample_rate = load_signal(filepath)
    
    # Convert to mono if stereo
    if len(data.shape) > 1:
        print("  Converting stereo to mono...")
        data = convert_to_mono(data)
    
    # Store original data (never modified)
    self.original_data = data.copy()
    self.data = data
    self.sample_rate = sample_rate
    self.original_length = len(data)
    
    print(f"✓ Signal loaded and ready for processing")
    print(f"  - Length: {self.original_length} samples")
    print(f"  - Duration: {self.original_length / self.sample_rate:.2f} seconds")
    print(f"  - Sample Rate: {self.sample_rate} Hz")
```

**FFT Computation (`equalizer_core.py` lines 147-184):**

```python
def compute_fft(self):
    """
    Compute FFT of the loaded signal.
    
    Returns:
        tuple: (frequencies, magnitudes, phases)
            - frequencies (np.ndarray): Frequency values in Hz
            - magnitudes (np.ndarray): Magnitude spectrum
            - phases (np.ndarray): Phase spectrum in radians
    
    Example:
        >>> freqs, mags, phases = processor.compute_fft()
        >>> print(f"Frequency range: {freqs[0]:.1f} to {freqs[-1]:.1f} Hz")
    """
    if self.data is None:
        raise ValueError("No signal loaded. Use load_from_file() or set_signal() first.")
    
    print("Computing FFT...")
    
    # Compute FFT (with automatic zero-padding to power of 2)
    self.freq_domain = fft(self.data)
    
    # Calculate frequency bins
    N = len(self.freq_domain)
    self.frequencies = frequency_bins(N, self.sample_rate)
    
    # Calculate magnitude and phase
    magnitudes = fft_magnitude(self.freq_domain)
    phases = fft_phase(self.freq_domain)
    
    print(f"✓ FFT computed: {N} frequency bins")
    print(f"  - Frequency resolution: {self.sample_rate / N:.2f} Hz/bin")
    print(f"  - Max frequency (Nyquist): {self.sample_rate / 2} Hz")
    
    return self.frequencies, magnitudes, phases
```

**Data State After Upload:**
```
Backend Session:
  processor.original_data = [audio samples] (never changes)
  processor.data = [audio samples] (same as original initially)
  processor.freq_domain = [FFT result] (computed once, cached)
  processor.frequencies = [frequency bins in Hz]
  processor.modified_freq_domain = None (not processed yet)

Frontend State:
  sessionId = "abc123..."
  inputWaveform = [downsampled signal data]
  outputWaveform = [same as inputWaveform]
  inputFftData = [magnitude spectrum]
  outputFftData = [same as inputFftData]
  audioUrlInput = "http://localhost:8000/api/audio/input?session_id=abc123&t=123456"
  audioUrlOutput = [same as audioUrlInput]
```

---

### Step 2: User Adjusts Sliders

**User Action:** User moves sliders to adjust frequency bands

**Frontend (`EqualizerSliders.jsx` lines 66-80):**

```jsx
// Handle change for a specific slider
const handleSliderInput = (index, event) => {
    const newGains = [...gains];
    const value = parseFloat(event.target.value);
    newGains[index] = value;
    setGains(newGains);
    // Call the parent handler with the index and the new gain value
    onChange(index, value); 
};
```

**Frontend (`App.jsx` lines 876-901):**

```jsx
// --- 4. Slider Change Handler (NO PROCESSING - just updates state) ---
// Expects a linear gain (0.0 .. 2.0). Backend stores linear multipliers directly.
const handleSliderChange = useCallback(
  (idx, linearGain) => {
    if (!sessionId || slidersConfig.length === 0) return;

    // 1. Update the local state instantly for responsive UI
    const updatedConfig = slidersConfig.map((slider, index) => {
      if (index === idx) {
        return { ...slider, gain: linearGain };
      }
      return slider;
    });

    setSlidersConfig(updatedConfig);

    // 2. Send to backend for temporary storage (FAST - no processing)
    // Payload contains linear gains (0.0 - 2.0)
    updateSlidersBackend(sessionId, updatedConfig).catch((err) => {
      console.error("Failed to update sliders:", err);
    });
  },
  [sessionId, slidersConfig]
);
```

**Backend (`main.py` lines 408-428):**

```python
@app.post("/api/update-sliders")
async def update_sliders(request: ProcessRequest):
    """
    Temporarily store slider configuration WITHOUT processing.
    This is fast - just saves the state for later use.
    """
    global slider_states
    
    # Convert sliders to dict
    slider_list = [s.model_dump() for s in request.sliders]
    
    # Store in memory
    slider_states[request.session_id] = slider_list
    
    print(f"💾 Sliders updated (not processed yet) for session {request.session_id[:8]}")
    
    return {
        'message': 'Sliders saved (not applied yet)',
        'slider_count': len(slider_list)
    }
```

**Important:** At this point, **NO audio processing happens**. The sliders just update:
- Frontend state (instant UI feedback)
- Backend temporary storage (for when user clicks "Apply Changes")

---

### Step 3: User Clicks "Apply Changes"

**User Action:** Clicks the green "Apply Changes & Process" button

**Frontend (`App.jsx` lines 905-980):**

```jsx
// --- 5. Apply Changes Handler (TRIGGERS PROCESSING) ---
const handleApplyChanges = useCallback(async () => {
  if (!sessionId || slidersConfig.length === 0) return;

  setProcessing(true);
  try {
    console.log("🎛️ Applying changes and processing signal...");
    console.log("   Session ID:", sessionId);
    console.log("   Sliders config:", slidersConfig);

    // Run the heavy processing (FFT→Gain→IFFT) on the server
    const processResult = await processSignal(sessionId, slidersConfig);
    console.log("   ✅ Process signal completed:", processResult);

    // Immediately construct fresh cache-busted URLs (use exact timestamp)
    const ts = Date.now();
    const newInputUrl = `${API_BASE_URL}/audio/input?session_id=${sessionId}&t=${ts}`;
    const newOutputUrl = `${API_BASE_URL}/audio/output?session_id=${sessionId}&t=${ts}`;
    
    console.log("📢 Updated audio URLs:");
    console.log("   Input:", newInputUrl);
    console.log("   Output:", newOutputUrl);

    // Immediately update the actual audio element to avoid races
    try {
      if (audioRefOutput?.current) {
        audioRefOutput.current.pause();
        audioRefOutput.current.currentTime = 0;
        audioRefOutput.current.src = newOutputUrl;
        audioRefOutput.current.load();
      }
      if (audioRefInput?.current) {
        audioRefInput.current.src = newInputUrl;
        audioRefInput.current.load();
      }
    } catch (err) {
      console.warn("Could not update audio element DOM directly:", err);
    }

    // Also keep React state in sync (single source for other effects/UI)
    setAudioUrlInput(newInputUrl);
    setAudioUrlOutput(newOutputUrl);

    // Fetch spectrogram data (best-effort)
    try {
      const inputSpec = await axios.get(
        `${API_BASE_URL}/spectrogram/input?session_id=${sessionId}`
      );
      setInputSpectrogramData(inputSpec.data);
    } catch (err) {
      console.warn("Could not fetch input spectrogram:", err);
    }

    try {
      const outputSpec = await axios.get(
        `${API_BASE_URL}/spectrogram/output?session_id=${sessionId}`
      );
      setOutputSpectrogramData(outputSpec.data);
    } catch (err) {
      console.warn("Could not fetch output spectrogram:", err);
    }

    // Fetch updated waveform and FFT data for visuals
    await fetchData(sessionId, "output_only");

    // Try to autoplay the updated output after a short delay
    setTimeout(() => {
      if (audioRefOutput?.current) {
        audioRefOutput.current
          .play()
          .catch((playErr) => console.warn("Audio play prevented:", playErr));
      }
    }, 150);

    console.log("Applied changes — audio element set to:", newOutputUrl);
  } catch (err) {
    console.error("Error applying changes:", err);
    alert("Failed to apply changes. Check console for details.");
  } finally {
    setProcessing(false);
  }
}, [sessionId, slidersConfig]);
```

**Backend (`main.py` lines 431-498):**

```python
@app.post("/api/process", response_model=ProcessResponse)
async def process_signal(request: ProcessRequest):
    """
    Applies gain from sliders and reconstructs the signal.
    This only runs when user clicks 'Apply Changes'.
    Uses the ALREADY COMPUTED FFT (no recomputation!).
    """
    global slider_states
    
    processor = await get_session(request.session_id)
    
    # FFT should already be computed during upload
    if processor.freq_domain is None:
        raise HTTPException(status_code=500, detail="FFT not computed. Re-upload file.")
        
    # Get slider configuration (either from request or stored state)
    slider_list = [s.model_dump() for s in request.sliders]
    slider_states[request.session_id] = slider_list
    
    # Debug: Print slider configuration
    print("\n" + "="*60)
    print("🎛️  APPLYING SLIDERS (FFT→Gain→IFFT):")
    for i, slider in enumerate(slider_list):
        print(f"   [{i}] Center: {slider['center_freq']:.1f} Hz, Width: {slider['width']:.1f} Hz, Gain: {slider['gain']:.2f}")
    
    # Create gain array from sliders
    gain_array = processor.create_gain_array_from_sliders(slider_list)
    
    # Debug: Show gain statistics
    print(f"📊 Gain Array Stats:")
    print(f"   Non-zero bins: {np.count_nonzero(gain_array)} / {len(gain_array)}")
    print(f"   Min gain: {np.min(gain_array):.4f}")
    print(f"   Max gain: {np.max(gain_array):.4f}")
    
    # Apply gain (uses cached FFT)
    modified_freq_domain = processor.apply_frequency_gain(gain_array)
    
    # Reconstruct signal (IFFT happens here)
    print(f"🔄 Running IFFT to reconstruct signal...")
    output_signal = processor.reconstruct_signal()
    
    # Debug: Output signal stats
    print(f"🔊 Output Signal:")
    print(f"   Max amplitude: {np.max(np.abs(output_signal)):.4f}")
    print(f"   Length: {len(output_signal)} samples")
    print(f"   processor.data updated: {processor.data is not None}")
    print(f"   processor.modified_freq_domain updated: {processor.modified_freq_domain is not None}")
    
    # CRITICAL: Verify the signal actually changed
    if processor.original_data is not None:
        diff = np.sum(np.abs(output_signal - processor.original_data[:len(output_signal)]))
        print(f"   🔍 DIFFERENCE from input: {diff:.2e} (should be >0 if processing worked)")
    print("="*60 + "\n")
    
    # Get updated spectrum (positive frequencies only)
    frequencies = processor.frequencies
    magnitudes = fft_magnitude(modified_freq_domain)
    
    positive_mask = frequencies >= 0
    
    return {
        'message': 'Signal processed successfully',
        'output_length': len(output_signal),
        'frequencies': frequencies[positive_mask].tolist(),
        'magnitudes': magnitudes[positive_mask].tolist(),
        'max_magnitude': float(np.max(np.abs(output_signal)))
    }
```

**Core DSP Operations (`equalizer_core.py` lines 186-228):**

```python
def apply_frequency_gain(self, gain_array):
    """
    Apply gain to frequency domain.
    
    This is the core equalization operation!
    
    Args:
        gain_array (np.ndarray): Array of gain values (same length as freq_domain)
            - Value of 1.0 = no change
            - Value > 1.0 = boost (amplify)
            - Value < 1.0 = attenuate (reduce)
            - Value of 0.0 = complete removal
    
    Returns:
        np.ndarray: Modified frequency domain (complex)
    """
    if self.freq_domain is None:
        # Compute FFT if not already done
        self.compute_fft()
    
    if len(gain_array) != len(self.freq_domain):
        raise ValueError(
            f"Gain array length ({len(gain_array)}) must match "
            f"frequency domain length ({len(self.freq_domain)})"
        )
    
    print(f"Applying frequency-domain gain...")
    print(f"  - Gain array range: [{np.min(gain_array):.3f}, {np.max(gain_array):.3f}]")
    
    # Element-wise multiplication: Y[k] = X[k] * G[k]
    # This modifies both magnitude AND phase!
    self.modified_freq_domain = self.freq_domain * gain_array
    
    print(f"✓ Gain applied to {len(self.freq_domain)} frequency bins")
    
    return self.modified_freq_domain
```

**IFFT Reconstruction (`equalizer_core.py` lines 230-270):**

```python
def reconstruct_signal(self):
    """
    Apply IFFT to reconstruct time-domain signal.
    
    Returns:
        np.ndarray: Reconstructed time-domain signal (real-valued)
    
    Raises:
        ValueError: If no modified frequency domain is available
    
    Example:
        >>> output_signal = processor.reconstruct_signal()
        >>> processor.save_output("output.wav", output_signal)
    """
    if self.modified_freq_domain is None:
        raise ValueError(
            "No modified frequency domain available. "
            "Call apply_frequency_gain() first."
        )
    
    print("Reconstructing signal via IFFT...")
    
    # Apply Inverse FFT
    reconstructed = ifft(self.modified_freq_domain)
    
    # Take real part (imaginary part should be ~0 for real input signals)
    reconstructed = np.real(reconstructed)
    
    # Trim to original length (remove zero-padding)
    reconstructed = reconstructed[:self.original_length]
    
    # Normalize to prevent clipping
    reconstructed = normalize_signal(reconstructed)
    
    # Update current data
    self.data = reconstructed
    
    print(f"✓ Signal reconstructed: {len(reconstructed)} samples")
    
    return reconstructed
```

**Processing Flow:**
```
1. User clicks "Apply Changes"
2. Frontend sends slider config to /api/process
3. Backend:
   a. Gets cached FFT (already computed during upload)
   b. Creates gain array from slider config
   c. Multiplies FFT by gain: modified_freq = freq_domain * gain_array
   d. Applies IFFT: output_signal = IFFT(modified_freq)
   e. Normalizes and updates processor.data
4. Frontend:
   a. Gets success response
   b. Updates audio URLs with cache buster (?t=timestamp)
   c. Forces audio element reload
   d. Fetches new waveform/FFT/spectrogram data
   e. Updates visualizations
```

---

### Step 4: Audio Serving & Visualization

**User Action:** Browser requests audio file, waveform data, FFT data

**Audio Serving (`main.py` lines 656-694):**

```python
@app.get("/api/audio/{signal_type}")
async def get_audio(signal_type: str, session_id: str):
    """
    Serves the audio file for playback.
    signal_type: 'input' or 'output'
    """
    processor = await get_session(session_id)
    
    # Generate output file path
    output_filename = f"{session_id}_{signal_type}.wav"
    output_path = os.path.join(OUTPUT_FOLDER, output_filename)
    
    # Save the appropriate signal to file EVERY TIME (to ensure freshness)
    if signal_type == "input":
        save_signal(output_path, processor.original_data, processor.sample_rate)
        print(f"🎵 Serving INPUT audio: {len(processor.original_data)} samples")
    elif signal_type == "output":
        # Use processed data if available, otherwise original
        data_to_save = processor.data if processor.data is not None else processor.original_data
        save_signal(output_path, data_to_save, processor.sample_rate)
        print(f"🎵 Serving OUTPUT audio: {len(data_to_save)} samples")
        print(f"   Max amplitude: {np.max(np.abs(data_to_save)):.4f}")
        print(f"   Modified: {processor.modified_freq_domain is not None}")
    else:
        raise HTTPException(status_code=400, detail="signal_type must be 'input' or 'output'")
    
    # Check if file exists
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail=f"Audio file not found: {output_path}")
    
    # Return the file
    return FileResponse(
        output_path,
        media_type="audio/wav",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )
```

**Key Insight:** 
- **Input audio:** Always serves `processor.original_data` (never modified)
- **Output audio:** Serves `processor.data` (modified by IFFT after processing)
- Cache headers prevent browser caching
- File is regenerated on EVERY request to ensure freshness

---

### Step 5: AI Source Separation (Demucs)

**User Action:** Clicks "Separate with AI (Demucs)" button

**Backend (`main.py` lines 764-831):**

```python
@app.post("/api/separate-demucs")
async def separate_with_demucs(session_id: str, model: str = "mdx_extra_q"):
    """
    Separate audio using Demucs (Meta's state-of-the-art source separation)
    
    Args:
        session_id: Active session ID
        model: Demucs model name (default: mdx_extra_q - highest quality)
               Options: htdemucs, htdemucs_ft, mdx, mdx_extra, mdx_extra_q
    
    Returns:
        dict: URLs to access separated stems (drums, bass, vocals, other)
    """
    processor = await get_session(session_id)
    
    # Get input file path
    input_path = None
    if getattr(processor, 'filepath', None):
        input_path = processor.filepath
        print(f"   Using UPLOADED file: {input_path}")
    else:
        # Save current signal to temporary file
        tmp_input = os.path.join(UPLOAD_FOLDER, f"{session_id}_mixed_output.wav")
        save_signal(tmp_input, processor.original_data, processor.sample_rate)
        input_path = tmp_input
        print(f"   Using GENERATED file from original_data: {input_path}")
    
    # Output directory for Demucs stems
    demucs_output_dir = os.path.join(OUTPUT_FOLDER, session_id, "demucs")
    os.makedirs(demucs_output_dir, exist_ok=True)
    
    try:
        # Initialize Demucs and separate
        demucs = DemucsIntegration(model_name=model)
        
        # Check if Demucs is installed
        if not demucs.is_installed():
            raise HTTPException(
                status_code=500, 
                detail="Demucs not installed. Install with: pip install demucs==3.0.6 torch==2.0.1 torchaudio==2.0.2"
            )
        
        print(f"\n{'='*60}")
        print(f"🎵 DEMUCS SEPARATION STARTED")
        print(f"   Session: {session_id}")
        print(f"   Model: {model}")
        print(f"   Input: {input_path}")
        print(f"{'='*60}\n")
        
        # Perform separation
        stems = demucs.separate(input_path, demucs_output_dir)
        
        # Build response with URLs to access stems (without /api/ prefix to avoid double prefix)
        stem_urls = {}
        for stem_name, stem_path in stems.items():
            stem_urls[stem_name] = f"/stem-demucs?session_id={session_id}&name={stem_name}&model={model}"
        
        print(f"\n✓ Demucs separation completed!")
        print(f"   Generated {len(stems)} stems: {list(stems.keys())}\n")
        
        return {
            'success': True,
            'message': f'Successfully separated audio into {len(stems)} stems',
            'model': model,
            'stems': stem_urls
        }
        
    except Exception as e:
        print(f"\n❌ Demucs separation failed: {str(e)}\n")
        raise HTTPException(status_code=500, detail=f"Demucs separation failed: {str(e)}")
```

**Output:** 4 audio stems saved to disk:
```
outputs/{session_id}/demucs/mdx_extra_q/{filename}/
  ├── drums.mp3    (or .wav)
  ├── bass.mp3
  ├── vocals.mp3
  └── other.mp3    (piano, guitar, etc.)
```

---

### Step 6: Mixing Separated Stems

**User Action:** Adjusts sliders, then clicks "Mix Stems with Current Slider Settings"

**Frontend (`App.jsx` lines 697-747):**

```jsx
// --- Demucs Stem Mixing Handler ---
const handleMixDemucsStems = async () => {
  if (!sessionId) {
    alert("Please upload a file first.");
    return;
  }

  if (!demucsStemUrls) {
    alert("Please run AI separation first.");
    return;
  }

  setMixingDemucsStems(true);
  setDemucsMixError("");
  setDemucsMixedData(null);

  try {
    // Extract gains from sliders (order: Drums, Bass, Vocals, Piano)
    // Convert dB values to linear multipliers: linearGain = 10^(dB/20)
    const gains = slidersConfig.map((slider) => {
      const dB = slider.gain;
      const linearGain = Math.pow(10, dB / 20);
      return linearGain;
    });

    console.log("Mixing Demucs stems:");
    slidersConfig.forEach((slider, idx) => {
      console.log(`  ${labels[idx]}: ${slider.gain.toFixed(1)} dB → ${gains[idx].toFixed(3)}x`);
    });

    const response = await axios.post(`${API_BASE_URL}/mix-demucs-stems`, {
      session_id: sessionId,
      gains: gains,
    });

    if (response.data.success) {
      console.log("Mixing successful:", response.data);
      setDemucsMixedData(response.data);
    }
  } catch (error) {
    console.error("Mixing error:", error);
    const errorMsg =
      error.response?.data?.detail || error.message || "Unknown error";
    setDemucsMixError(errorMsg);
    alert(`Mixing Error: ${errorMsg}`);
  } finally {
    setMixingDemucsStems(false);
  }
};
```

**Backend (`main.py` lines 888-1022):**

```python
@app.post("/api/mix-demucs-stems")
async def mix_demucs_stems(request: MixDemucsRequest):
    """
    Mix Demucs-separated stems (drums, bass, vocals, other) with slider gains
    
    Args:
        request: Contains session_id and gains array [drums, bass, vocals, piano/other]
    
    Returns:
        dict: Mixed audio URL, waveform data, FFT data, spectrogram data
    """
    session_id = request.session_id
    gains = request.gains
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    processor = sessions[session_id]
    
    # Get stem file paths
    filename_base = None
    if getattr(processor, 'filepath', None):
        filename_base = Path(processor.filepath).stem
    else:
        filename_base = f"{session_id}_demucs_input"
    
    model = "mdx_extra_q"  # Default model
    demucs_output_dir = os.path.join(OUTPUT_FOLDER, session_id, "demucs", model, filename_base)
    
    # Check if stems exist
    if not os.path.exists(demucs_output_dir):
        raise HTTPException(
            status_code=404,
            detail="Demucs stems not found. Please run AI separation first."
        )
    
    try:
        print(f"\n{'='*60}")
        print(f"🎛️ MIXING DEMUCS STEMS")
        print(f"   Session: {session_id}")
        print(f"   Gains: {gains}")
        print(f"{'='*60}\n")
        
        # Load stems (order: drums, bass, vocals, other)
        stem_names = ['drums', 'bass', 'vocals', 'other']
        stems_data = []
        sample_rate = None
        
        for stem_name in stem_names:
            stem_path_mp3 = os.path.join(demucs_output_dir, f"{stem_name}.mp3")
            stem_path_wav = os.path.join(demucs_output_dir, f"{stem_name}.wav")
            
            if os.path.exists(stem_path_wav):
                stem_path = stem_path_wav
            elif os.path.exists(stem_path_mp3):
                stem_path = stem_path_mp3
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Stem '{stem_name}' not found in {demucs_output_dir}"
                )
            
            # Load stem audio
            import soundfile as sf
            stem_signal, sr = sf.read(stem_path)
            
            # Convert to mono if stereo
            if len(stem_signal.shape) > 1:
                stem_signal = np.mean(stem_signal, axis=1)
            
            stems_data.append(stem_signal)
            if sample_rate is None:
                sample_rate = sr
        
        # Ensure all stems have the same length (pad with zeros if needed)
        max_length = max(len(s) for s in stems_data)
        for i in range(len(stems_data)):
            if len(stems_data[i]) < max_length:
                stems_data[i] = np.pad(stems_data[i], (0, max_length - len(stems_data[i])))
        
        # Apply gains and mix
        mixed_signal = np.zeros(max_length, dtype=np.float64)
        for i, (stem, gain) in enumerate(zip(stems_data, gains)):
            print(f"   {stem_names[i]}: gain={gain:.2f}x")
            mixed_signal += stem * gain
        
        # Normalize to prevent clipping
        max_val = np.max(np.abs(mixed_signal))
        if max_val > 0:
            mixed_signal = mixed_signal / max_val * 0.95  # Leave headroom
        
        # Save mixed audio
        mixed_output_path = os.path.join(OUTPUT_FOLDER, session_id, "demucs_mixed.wav")
        save_signal(mixed_output_path, mixed_signal, sample_rate)
        
        print(f"   ✓ Mixed audio saved to: {mixed_output_path}")
        
        # Compute waveform data (downsample for visualization)
        downsample_factor = max(1, len(mixed_signal) // 2000)
        waveform_data = mixed_signal[::downsample_factor].tolist()
        time_axis = (np.arange(len(waveform_data)) * downsample_factor / sample_rate).tolist()
        
        # Compute FFT
        fft_result = fft(mixed_signal)
        freqs = frequency_bins(len(mixed_signal), sample_rate)
        mags = fft_magnitude(fft_result)
        
        # [... continues with spectrogram computation and return ...]
```

**Mixing Formula:**
```
For each stem (drums, bass, vocals, other):
  1. Convert slider dB to linear: linear_gain = 10^(dB/20)
  2. Multiply stem audio: weighted_stem = stem_audio * linear_gain
  3. Add to mix: mixed_audio += weighted_stem

Finally: Normalize to prevent clipping
```

---

## Data Flow Diagrams

### Upload & Initial Display Flow

```
User Selects File
       │
       ▼
┌────────────────────────────────────────────────┐
│ Frontend: handleFileUpload()                   │
│ - Create FormData with file                   │
│ - Call uploadFileAndStartSession()             │
└──────────────┬─────────────────────────────────┘
               │ POST /api/upload
               ▼
┌────────────────────────────────────────────────┐
│ Backend: upload_file()                         │
│ 1. Generate session_id (UUID)                 │
│ 2. Save file to uploads/                      │
│ 3. Create SignalProcessor(filepath)           │
│ 4. processor.compute_fft() [ONE-TIME FFT]     │
│ 5. sessions[session_id] = processor           │
│ 6. Return session_id + file info              │
└──────────────┬─────────────────────────────────┘
               │ Response
               ▼
┌────────────────────────────────────────────────┐
│ Frontend: Process Response                     │
│ 1. setSessionId(newSessionId)                 │
│ 2. Set audio URLs (input & output same)       │
│ 3. Fetch waveform data (input & output same)  │
│ 4. Fetch FFT data (input & output same)       │
│ 5. Fetch spectrogram (input & output same)    │
│ 6. Display all visualizations                 │
└────────────────────────────────────────────────┘
               │
               ▼
        User sees graphs & hears audio
```

### EQ Processing Flow

```
User Moves Sliders
       │
       ▼
┌────────────────────────────────────────────────┐
│ Frontend: handleSliderChange()                 │
│ - Update local state (instant UI)             │
│ - Call updateSlidersBackend() [optional]      │
└────────────────────────────────────────────────┘
       │
       ▼
User Clicks "Apply Changes"
       │
       ▼
┌────────────────────────────────────────────────┐
│ Frontend: handleApplyChanges()                 │
│ - Call processSignal(sessionId, slidersConfig)│
└──────────────┬─────────────────────────────────┘
               │ POST /api/process
               ▼
┌────────────────────────────────────────────────┐
│ Backend: process_signal()                      │
│ 1. Get cached FFT (from upload)               │
│ 2. Create gain_array from sliders             │
│ 3. modified_freq = freq_domain * gain_array   │
│ 4. output = IFFT(modified_freq)               │
│ 5. Normalize & trim output                    │
│ 6. processor.data = output                    │
│ 7. Return success + FFT data                  │
└──────────────┬─────────────────────────────────┘
               │ Response
               ▼
┌────────────────────────────────────────────────┐
│ Frontend: Update UI                            │
│ 1. Update audio URLs (with cache buster)      │
│ 2. Reload audio elements                      │
│ 3. Fetch new waveform data                    │
│ 4. Fetch new FFT data                         │
│ 5. Fetch new spectrogram                      │
│ 6. Update all visualizations                  │
│ 7. Auto-play output audio                     │
└────────────────────────────────────────────────┘
               │
               ▼
        User hears equalized audio
```

### AI Separation + Mixing Flow

```
User Clicks "Separate with AI"
       │
       ▼
┌────────────────────────────────────────────────┐
│ Frontend: handleDemucsSeparation()             │
│ - POST /api/separate-demucs                   │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ Backend: separate_with_demucs()                │
│ 1. Get processor.filepath (original file)     │
│ 2. Initialize DemucsIntegration                │
│ 3. Run Demucs AI model (30-60 seconds)        │
│ 4. Save 4 stems: drums, bass, vocals, other   │
│ 5. Return stem URLs                           │
└──────────────┬─────────────────────────────────┘
               │ Response
               ▼
┌────────────────────────────────────────────────┐
│ Frontend: Display Stems                        │
│ - Show 4 audio players (one per stem)         │
│ - Enable "Mix Stems" button                   │
└────────────────────────────────────────────────┘
       │
       ▼
User Adjusts Sliders → Clicks "Mix Stems"
       │
       ▼
┌────────────────────────────────────────────────┐
│ Frontend: handleMixDemucsStems()               │
│ 1. Convert slider dB to linear (10^(dB/20))   │
│ 2. POST /api/mix-demucs-stems with gains      │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ Backend: mix_demucs_stems()                    │
│ 1. Load all 4 stems from disk                 │
│ 2. For each stem: weighted = stem * gain      │
│ 3. mixed = sum(all weighted stems)            │
│ 4. Normalize to prevent clipping              │
│ 5. Save mixed audio to disk                   │
│ 6. Compute waveform, FFT, spectrogram         │
│ 7. Return all visualization data              │
└──────────────┬─────────────────────────────────┘
               │ Response
               ▼
┌────────────────────────────────────────────────┐
│ Frontend: Display Mixed Output                 │
│ - Show mixed audio player                     │
│ - Show waveform (CinePlayer)                  │
│ - Show FFT graph                              │
│ - Show spectrogram                            │
└────────────────────────────────────────────────┘
               │
               ▼
        User hears custom mix
```

---

## Session State Management

### Backend Session Storage

```python
# main.py lines 124-130
sessions: Dict[str, SignalProcessor] = {}  # In-memory session storage
slider_states: Dict[str, List[Dict]] = {}  # Temporary slider states

# Each session contains:
sessions["abc123..."] = SignalProcessor(
    filepath="/path/to/uploads/abc123_audio.wav",
    original_data=np.array([...]),      # Never modified
    data=np.array([...]),                # Modified by IFFT
    freq_domain=np.array([...]),         # Cached FFT result
    modified_freq_domain=np.array([...]), # After applying gains
    frequencies=np.array([...]),         # Frequency bins
    sample_rate=44100,
    original_length=220500
)
```

### Frontend State Management

```jsx
// App.jsx key state variables
const [sessionId, setSessionId] = useState(null);  // "abc123..."
const [slidersConfig, setSlidersConfig] = useState([]);  // Current slider values
const [inputWaveform, setInputWaveform] = useState([]);  // For visualization
const [outputWaveform, setOutputWaveform] = useState([]);
const [inputFftData, setInputFftData] = useState([]);
const [outputFftData, setOutputFftData] = useState([]);
const [audioUrlInput, setAudioUrlInput] = useState("");
const [audioUrlOutput, setAudioUrlOutput] = useState("");
const [demucsStemUrls, setDemucsStemUrls] = useState(null);  // After AI separation
const [demucsMixedData, setDemucsMixedData] = useState(null);  // After mixing
```

---

## Key Design Decisions

### 1. **FFT Computed Once on Upload**
- **Why:** FFT is computationally expensive (O(N log N))
- **How:** Computed in `/api/upload` endpoint, cached in `processor.freq_domain`
- **Benefit:** Applying sliders is instant (just multiplication + IFFT)

### 2. **Slider Updates Don't Trigger Processing**
- **Why:** Avoid unnecessary IFFT operations while user is adjusting
- **How:** Sliders update local state only, send to backend for storage
- **Trigger:** User explicitly clicks "Apply Changes" button

### 3. **Input = Output Initially**
- **Why:** User should see original audio before processing
- **How:** After upload, frontend sets both to same data
- **Result:** Both visualizations show identical waveforms/FFT

### 4. **Cache Busting for Audio URLs**
- **Why:** Browser aggressively caches audio files
- **How:** Append timestamp query parameter: `?session_id=abc&t=1234567890`
- **Result:** Browser fetches new file after every process operation

### 5. **Demucs Uses Original File**
- **Why:** AI models work better on unprocessed audio
- **How:** Always use `processor.filepath` or `processor.original_data`
- **Result:** Separation quality is independent of EQ settings

### 6. **dB to Linear Conversion**
- **Formula:** `linear_gain = 10^(dB/20)`
- **Why:** Audio amplitude is logarithmic (decibels), but DSP math is linear
- **Examples:**
  - 0 dB → 1.0x (no change)
  - +20 dB → 10.0x (10× louder)
  - -20 dB → 0.1x (10× quieter)
  - -40 dB → 0.01x (near silence)

---

## Troubleshooting Guide

### Problem: "Output audio sounds the same as input"

**Check:**
1. Backend logs: Did IFFT actually run?
2. Backend logs: Is `DIFFERENCE from input` > 0?
3. Browser console: Did audio URL get cache buster?
4. Backend: Is `processor.data` different from `processor.original_data`?

**Solution:** Ensure `/api/process` is called and `processor.data` is updated

---

### Problem: "Sliders don't affect the output"

**Check:**
1. Are you clicking "Apply Changes" button?
2. Backend logs: What are the slider gain values?
3. Backend logs: What is the gain_array range?

**Solution:** Sliders must be applied via "Apply Changes" to trigger processing

---

### Problem: "Browser plays old audio after processing"

**Check:**
1. Is cache buster timestamp in URL?
2. Did audio element `src` actually change?
3. Did you call `audio.load()`?

**Solution:** Force reload with:
```jsx
audioRefOutput.current.pause();
audioRefOutput.current.currentTime = 0;
audioRefOutput.current.src = newOutputUrl;
audioRefOutput.current.load();
```

---

### Problem: "Demucs separation fails"

**Check:**
1. Is Demucs installed? `pip install demucs==3.0.6`
2. Is PyTorch installed? `pip install torch==2.0.1 torchaudio==2.0.2`
3. Is file path correct?

**Solution:** Install dependencies and check backend logs for detailed error

---

## Performance Optimization

### Backend Optimizations
1. **FFT Caching:** Compute once, reuse for all slider adjustments
2. **Downsample for Visualization:** Send 2000 points instead of 220,000
3. **Lazy Spectrogram:** Only compute when requested
4. **In-Memory Sessions:** Avoid disk I/O for temporary data

### Frontend Optimizations
1. **debounce Slider Updates:** Don't send every pixel movement to backend
2. **Canvas Rendering:** Direct pixel manipulation for waveforms
3. **Parallel Requests:** Fetch waveform, FFT, spectrogram simultaneously
4. **Ref-Based Audio:** Avoid unnecessary re-renders of audio elements

---

## API Endpoint Reference

| Endpoint | Method | Purpose | Key Parameters |
|----------|--------|---------|----------------|
| `/api/upload` | POST | Upload file, create session | `file` (multipart) |
| `/api/process` | POST | Apply EQ, run IFFT | `session_id`, `sliders[]` |
| `/api/audio/{type}` | GET | Serve audio file | `session_id`, `type` (input/output) |
| `/api/signal/{type}` | GET | Get waveform data | `session_id`, `type` |
| `/api/fft/compute/{type}` | GET | Get FFT data | `session_id`, `type` |
| `/api/spectrogram/{type}` | GET | Get spectrogram JSON | `session_id`, `type` |
| `/api/separate-demucs` | POST | Run AI separation | `session_id`, `model` |
| `/api/stem-demucs` | GET | Serve stem file | `session_id`, `name` |
| `/api/mix-demucs-stems` | POST | Mix stems with gains | `session_id`, `gains[]` |
| `/api/update-sliders` | POST | Store slider state | `session_id`, `sliders[]` |

---

## File Structure Summary

```
music-eq-backend/
├── main.py                    # FastAPI app, all endpoints
├── backend/
│   ├── equalizer_core.py      # SignalProcessor class (main DSP)
│   ├── fft_implementation.py  # Custom FFT/IFFT (Cooley-Tukey)
│   ├── signal_io.py           # Audio file I/O (load/save)
│   ├── demucs_integration.py  # Demucs AI wrapper
│   └── human_separation.py    # Human voice separation
├── uploads/                   # Uploaded audio files
├── outputs/                   # Processed audio, spectrograms, stems
└── models/                    # Cached AI models

music-eq-frontend/
├── src/
│   ├── App.jsx               # Main React component (all logic)
│   ├── components/
│   │   ├── EqualizerSliders.jsx  # Slider UI component
│   │   └── GenericMode.jsx       # Alternative UI mode
│   └── components-generic/
│       ├── FrequencyGraph.jsx    # FFT visualization
│       └── Spectrogram.jsx       # Spectrogram visualization
└── public/                   # Static assets
```

---

## Conclusion

This equalizer demonstrates a **complete DSP pipeline** with modern web technologies:
- **Custom FFT implementation** (educational requirement)
- **State-of-the-art AI** (Demucs source separation)
- **Responsive UI** (React with instant slider feedback)
- **Efficient processing** (FFT caching, one-time computation)
- **Professional visualizations** (waveform, FFT, spectrogram)

The architecture separates concerns cleanly:
- **Frontend:** UI, user interaction, visualization
- **Backend:** DSP operations, session management, file I/O
- **AI Integration:** Modular, swappable separation models

All code follows best practices with extensive logging, error handling, and type validation.
