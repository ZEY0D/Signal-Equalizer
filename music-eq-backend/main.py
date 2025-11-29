import uvicorn
import numpy as np
import os
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import shutil
from pathlib import Path
try:
    from spleeter.separator import Separator
except Exception:
    Separator = None
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid

# --- Import Your Custom Modules ---
# This matches your project structure image (api/ and core/ folders)
from backend.equalizer_core import SignalProcessor, create_synthetic_test_signal
from backend.fft_implementation import fft, ifft, fft_magnitude, fft_phase, frequency_bins
import time
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from backend.signal_io import save_signal
from backend.demucs_integration import DemucsIntegration
from backend.human_separation import HumanVoiceSeparation

# --- Pydantic Models (for API validation) ---
# These define the data structures for your API requests and responses

class Slider(BaseModel):
    """Defines the structure for a single slider from the frontend"""
    center_freq: float
    width: float
    gain: float

class ProcessRequest(BaseModel):
    """Defines the request body for the /process endpoint"""
    session_id: str
    sliders: List[Slider]

class SyntheticRequest(BaseModel):
    """Defines the request for a synthetic signal"""
    session_id: Optional[str] = None
    frequencies: List[float] = [100, 500, 1000, 2000]
    duration: float = 2.0
    sample_rate: int = 44100

class ConfigSaveRequest(BaseModel):
    """Defines the request for saving a config"""
    session_id: str
    config_name: str
    config: Dict[str, Any]

class ResetRequest(BaseModel):
    """Defines the request for resetting"""
    session_id: str

class SignalInfoResponse(BaseModel):
    """Defines the info returned on file upload"""
    session_id: str
    filename: str
    sample_rate: int
    duration: float
    length: int
    message: str

class FFTResponse(BaseModel):
    """Defines the data sent for the FFT graph"""
    frequencies: List[float]
    magnitudes: List[float]
    phases: List[float]
    length: int

class ProcessResponse(BaseModel):
    """Defines the data sent after applying the equalizer"""
    message: str
    output_length: int
    frequencies: List[float]
    magnitudes: List[float]
    max_magnitude: float
    # Optional URLs for spectrogram images
    input_spectrogram_url: Optional[str] = None
    output_spectrogram_url: Optional[str] = None

class SignalDataResponse(BaseModel):
    """Defines the data for the time-domain signal viewers"""
    signal: List[float]
    time_axis: List[float]
    sample_rate: int
    length: int
    start: int
    end: int

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Signal Equalizer API (FastAPI)",
    description="Backend for the DSP project, built by Zeyad Ashraf."
)

# --- Add CORS Middleware ---
# CRITICAL for your React frontend (e.g., localhost:3000)
# to talk to this server (e.g., localhost:8000).
origins = [
    "http://localhost:3000", # React's default dev server
    "http://localhost:5173", # Vite's default dev server
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],
)

# --- Session Management ---
# This is a simple in-memory dictionary to hold a SignalProcessor for each user
sessions: Dict[str, SignalProcessor] = {}

# Store slider states temporarily (before applying)
slider_states: Dict[str, List[Dict]] = {}

# --- File Paths ---
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"
CONFIG_FOLDER = "configs"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(CONFIG_FOLDER, exist_ok=True)


# --- Helper Functions ---
def compute_spectrogram_data(signal, sample_rate, window_size=1024, overlap=0.75):
    """
    Compute spectrogram using Short-Time Fourier Transform (STFT).
    Shared by both PNG and JSON spectrogram endpoints.
    
    Args:
        signal: Time-domain signal (1D numpy array)
        sample_rate: Sampling rate in Hz
        window_size: FFT window size (number of samples)
        overlap: Overlap ratio between 0.0 and 1.0
    
    Returns:
        tuple: (times, frequencies, magnitude)
            - times: Array of time values for each window
            - frequencies: Array of frequency bins
            - magnitude: 2D array of magnitudes (frequencies x times)
    """
    hop_size = int(window_size * (1 - overlap))
    
    # Calculate number of windows
    num_windows = max(1, (len(signal) - window_size) // hop_size + 1)
    
    # Initialize output arrays
    frequencies = np.fft.rfftfreq(window_size, 1/sample_rate)
    times = np.arange(num_windows) * hop_size / sample_rate
    magnitude = np.zeros((num_windows, len(frequencies)))
    
    # Apply Hann window for smooth transitions
    window = np.hanning(window_size)
    
    # Compute FFT for each window
    for i in range(num_windows):
        start_idx = i * hop_size
        end_idx = start_idx + window_size
        
        if end_idx > len(signal):
            # Pad with zeros if needed
            segment = np.zeros(window_size)
            available = len(signal) - start_idx
            segment[:available] = signal[start_idx:]
        else:
            segment = signal[start_idx:end_idx]
        
        # Apply window and compute FFT
        windowed = segment * window
        fft_result = np.fft.rfft(windowed)
        magnitude[i, :] = np.abs(fft_result)
    
    return times, frequencies, magnitude


# --- Dependency for Session Management ---
async def get_session(session_id: str) -> SignalProcessor:
    """FastAPI Dependency to get a valid session processor"""
    processor = sessions.get(session_id)
    if not processor:
        raise HTTPException(status_code=404, detail="Invalid or expired session_id")
    return processor

# --- API Endpoints ---

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        'status': 'ok',
        'message': 'Signal Equalizer Backend (FastAPI) is running',
        'active_sessions': len(sessions)
    }

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

@app.post("/api/synthetic", response_model=SignalInfoResponse)
async def create_synthetic(request: SyntheticRequest):
    """
    Creates a synthetic test signal and initializes a new session.
    """
    global sessions
    
    # Get or create session
    session_id = request.session_id if request.session_id else str(uuid.uuid4())
    
    try:
        # Create synthetic signal
        signal, sr = create_synthetic_test_signal(
            request.frequencies, 
            request.duration, 
            request.sample_rate
        )
        
        # Initialize processor
        processor = SignalProcessor()
        processor.set_signal(signal, sr)
        
        # Store in session
        sessions[session_id] = processor
        
        return {
            'session_id': session_id,
            'filename': 'synthetic_signal.wav',
            'sample_rate': sr,
            'duration': request.duration,
            'length': len(signal),
            'message': 'Synthetic signal created successfully'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/fft/compute", response_model=FFTResponse)
async def compute_fft(session_id: str, positive_only: bool = True):
    """
    Computes and returns the FFT data for the graphs.
    """
    processor = await get_session(session_id)
    
    # Compute FFT
    frequencies, magnitudes, phases = processor.compute_fft()
    
    if positive_only:
        positive_mask = frequencies >= 0
        frequencies = frequencies[positive_mask]
        magnitudes = magnitudes[positive_mask]
        phases = phases[positive_mask]
        
    return {
        'frequencies': frequencies.tolist(),
        'magnitudes': magnitudes.tolist(),
        'phases': phases.tolist(),
        'length': len(frequencies)
    }

@app.get("/api/fft/output", response_model=FFTResponse)
async def get_output_fft(session_id: str, positive_only: bool = True):
    """
    Get FFT of the OUTPUT (processed) signal.
    """
    processor = await get_session(session_id)
    
    # Check if processed signal exists
    if processor.modified_freq_domain is None:
        raise HTTPException(status_code=400, detail="No processed signal available. Process the signal first.")
    
    # Use the already computed modified frequency domain
    frequencies = processor.frequencies
    magnitudes = fft_magnitude(processor.modified_freq_domain)
    phases = fft_phase(processor.modified_freq_domain)
    
    if positive_only:
        positive_mask = frequencies >= 0
        frequencies = frequencies[positive_mask]
        magnitudes = magnitudes[positive_mask]
        phases = phases[positive_mask]
        
    return {
        'frequencies': frequencies.tolist(),
        'magnitudes': magnitudes.tolist(),
        'phases': phases.tolist(),
        'length': len(frequencies)
    }

@app.get("/api/spectrogram/input")
async def get_input_spectrogram(session_id: str, window_size: int = 1024, overlap: float = 0.75):
    """
    Get spectrogram data for INPUT signal (returns JSON for Generic Mode).
    Uses the same computation as PNG spectrogram endpoint.
    """
    processor = await get_session(session_id)
    
    if processor.original_data is None:
        raise HTTPException(status_code=400, detail="No input signal available. Upload or create a signal first.")
    
    # Compute spectrogram using shared function
    times, frequencies, magnitude = compute_spectrogram_data(
        processor.original_data, 
        processor.sample_rate, 
        window_size, 
        overlap
    )
    
    return {
        'times': times.tolist(),
        'frequencies': frequencies.tolist(),
        'magnitude': magnitude.tolist(),  # 2D array: [time_windows][frequency_bins]
        'sample_rate': processor.sample_rate
    }

@app.get("/api/spectrogram/output")
async def get_output_spectrogram(session_id: str, window_size: int = 1024, overlap: float = 0.75):
    """
    Get spectrogram data for OUTPUT signal (returns JSON for Generic Mode).
    Uses the same computation as PNG spectrogram endpoint.
    """
    processor = await get_session(session_id)
    
    if processor.data is None or processor.modified_freq_domain is None:
        raise HTTPException(status_code=400, detail="No processed signal available. Process the signal first.")
    
    # Compute spectrogram using shared function
    times, frequencies, magnitude = compute_spectrogram_data(
        processor.data, 
        processor.sample_rate, 
        window_size, 
        overlap
    )
    
    return {
        'times': times.tolist(),
        'frequencies': frequencies.tolist(),
        'magnitude': magnitude.tolist(),  # 2D array: [time_windows][frequency_bins]
        'sample_rate': processor.sample_rate
    }

@app.post("/api/update-sliders")
async def update_sliders(request: ProcessRequest):
    """
    Store slider configuration temporarily WITHOUT processing.
    This is fast - just saves the slider state in memory.
    """
    global slider_states
    
    processor = await get_session(request.session_id)
    slider_list = [s.model_dump() for s in request.sliders]
    
    # Store slider state
    slider_states[request.session_id] = slider_list
    
    print(f"💾 Sliders updated (not processed yet) for session {request.session_id[:8]}")
    
    return {
        'message': 'Sliders saved (not applied yet)',
        'slider_count': len(slider_list)
    }


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


@app.get('/api/fft/compute/{signal_type}', response_model=FFTResponse)
async def compute_fft_for_type(signal_type: str, session_id: str, positive_only: bool = True):
    """
    Compute FFT for either 'input' or 'output' signal and return frequency/magnitude/phase.
    This endpoint matches the frontend's expected path `/api/fft/compute/{type}`.
    """
    processor = await get_session(session_id)

    if signal_type == 'input':
        signal = processor.original_data
    else:
        signal = processor.data if processor.data is not None else processor.original_data

    if signal is None:
        raise HTTPException(status_code=404, detail='No signal available for FFT')

    # Compute FFT using the project's fft implementation
    freq_domain = fft(signal)
    N = len(freq_domain)
    frequencies = frequency_bins(N, processor.sample_rate)
    magnitudes = fft_magnitude(freq_domain)
    phases = fft_phase(freq_domain)

    if positive_only:
        mask = frequencies >= 0
        frequencies = frequencies[mask]
        magnitudes = magnitudes[mask]
        phases = phases[mask]

    return {
        'frequencies': frequencies.tolist(),
        'magnitudes': magnitudes.tolist(),
        'phases': phases.tolist(),
        'length': len(frequencies)
    }

@app.get("/api/signal/input", response_model=SignalDataResponse)
async def get_input_signal(session_id: str, max_points: int = 10000):
    """Gets the input signal waveform for (Student 2's) viewer."""
    processor = await get_session(session_id)
    signal = processor.original_data
    
    # Downsample for frontend performance
    if len(signal) > max_points:
        step = len(signal) // max_points
        signal = signal[::step]
    else:
        step = 1
        
    time_axis = (np.arange(len(signal)) * step) / processor.sample_rate
    
    return {
        'signal': signal.tolist(),
        'time_axis': time_axis.tolist(),
        'sample_rate': processor.sample_rate,
        'length': len(processor.original_data),
        'start': 0,
        'end': len(processor.original_data)
    }

@app.get("/api/signal/output", response_model=SignalDataResponse)
async def get_output_signal(session_id: str, max_points: int = 10000):
    """Gets the output (processed) signal waveform."""
    processor = await get_session(session_id)
    
    # Use processed signal if available, otherwise fall back to original
    if processor.data is not None and processor.modified_freq_domain is not None:
        signal = processor.data
        print(f"📤 Returning PROCESSED output signal (length: {len(signal)})")
    else:
        signal = processor.original_data
        print(f"📤 Returning ORIGINAL signal as output (not yet processed)")
    
    if signal is None:
        raise HTTPException(status_code=400, detail="No signal available")
    
    original_length = len(signal)
    
    # Downsample for visualization
    if len(signal) > max_points:
        step = len(signal) // max_points
        signal = signal[::step]
    else:
        step = 1
        
    time_axis = (np.arange(len(signal)) * step) / processor.sample_rate
    
    return {
        'signal': signal.tolist(),
        'time_axis': time_axis.tolist(),
        'sample_rate': processor.sample_rate,
        'length': original_length,
        'start': 0,
        'end': original_length
    }

@app.post("/api/reset")
async def reset_signal(request: ResetRequest):
    """Resets the signal to its original state."""
    processor = await get_session(request.session_id)
    processor.reset()
    return {'message': 'Signal reset to original state'}

@app.post("/api/config/save")
async def save_config(request: ConfigSaveRequest):
    """Saves a slider configuration to a JSON file."""
    config_name = request.config_name
    config = request.config
    
    config_path = os.path.join(CONFIG_FOLDER, f"{config_name}.json")
    
    try:
        with open(config_path, 'w') as f:
            import json
            json.dump(config, f, indent=2)
        return {
            'message': 'Configuration saved successfully',
            'config_path': str(config_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config/load")
async def load_config(config_name: str):
    """Loads a slider configuration from a JSON file."""
    config_path = os.path.join(CONFIG_FOLDER, f"{config_name}.json")
    
    if not os.path.exists(config_path):
        raise HTTPException(status_code=404, detail="Configuration not found")
        
    try:
        with open(config_path, 'r') as f:
            import json
            config = json.load(f)
        return {
            'config': config,
            'config_name': config_name,
            'message': 'Configuration loaded successfully'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config/list")
async def list_configs():
    """Lists all available .json configuration files."""
    try:
        configs = [f.replace('.json', '') for f in os.listdir(CONFIG_FOLDER) if f.endswith('.json')]
        return {'configs': configs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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


@app.post("/api/separate")
async def separate_session(session_id: str):
    """
    Run source separation on the session's audio using Spleeter (5 stems).
    Returns URLs (paths) to generated stems.
    """
    if Separator is None:
        raise HTTPException(status_code=500, detail="Spleeter not installed on the server. Install 'spleeter' and ffmpeg first.")

    processor = await get_session(session_id)

    # Determine input file: prefer original uploaded file, otherwise create temp WAV
    input_path = None
    if getattr(processor, 'filepath', None):
        input_path = processor.filepath
    else:
        # Save current original_data to a temporary wav file
        tmp_input = os.path.join(UPLOAD_FOLDER, f"{session_id}_temp_input.wav")
        save_signal(tmp_input, processor.original_data, processor.sample_rate)
        input_path = tmp_input

    # Output directory for stems
    stems_dir = os.path.join(OUTPUT_FOLDER, f"{session_id}", "stems")
    os.makedirs(stems_dir, exist_ok=True)

    # Use Spleeter 5stems
    sep = Separator('spleeter:5stems')
    try:
        # separate_to_file will create a subfolder named after input file inside stems_dir
        sep.separate_to_file(input_path, stems_dir, codec='wav')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Spleeter separation failed: {str(e)}")

    # Find the generated folder (spleeter creates <stems_dir>/<input_basename> folder)
    input_basename = Path(input_path).stem
    generated_dir = os.path.join(stems_dir, input_basename)
    if not os.path.exists(generated_dir):
        # sometimes spleeter writes files directly in stems_dir
        generated_dir = stems_dir

    # Map available stems to returnable paths
    stems = {}
    # Typical spleeter stem filenames: vocals.wav, drums.wav, bass.wav, piano.wav, other.wav
    for stem_name in ['vocals', 'drums', 'bass', 'piano', 'other']:
        candidate = os.path.join(generated_dir, f"{stem_name}.wav")
        if os.path.exists(candidate):
            stems[stem_name] = f"/api/stem?session_id={session_id}&name={stem_name}"

    if len(stems) == 0:
        raise HTTPException(status_code=500, detail="No stems were generated by Spleeter")

    return { 'stems': stems }


@app.get('/api/stem')
async def get_stem(session_id: str, name: str):
    """Serve a separated stem file for the session."""
    stems_dir = os.path.join(OUTPUT_FOLDER, f"{session_id}", "stems")
    # try candidate locations
    candidate1 = os.path.join(stems_dir, f"{session_id}_temp_input", f"{name}.wav")
    candidate2 = os.path.join(stems_dir, f"{Path(getattr(sessions.get(session_id), 'filepath') or '').stem}", f"{name}.wav") if sessions.get(session_id) and getattr(sessions.get(session_id), 'filepath', None) else ''
    candidate3 = os.path.join(stems_dir, f"{name}.wav")

    for p in [candidate1, candidate2, candidate3]:
        if p and os.path.exists(p):
            return FileResponse(p, media_type='audio/wav', headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

    raise HTTPException(status_code=404, detail=f"Stem '{name}' not found for session {session_id}")


# --- Demucs Separation Endpoints ---

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
    else:
        # Save current signal to temporary file
        tmp_input = os.path.join(UPLOAD_FOLDER, f"{session_id}_demucs_input.wav")
        save_signal(tmp_input, processor.original_data, processor.sample_rate)
        input_path = tmp_input
    
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


@app.get("/api/stem-demucs")
async def get_demucs_stem(session_id: str, name: str, model: str = "mdx_extra_q"):
    """
    Serve a Demucs-separated stem file
    
    Args:
        session_id: Session ID
        name: Stem name (drums, bass, vocals, other)
        model: Model used for separation
    
    Returns:
        FileResponse: Audio file of the separated stem (WAV or MP3)
    """
    # Build path to stem file
    filename_base = None
    processor = sessions.get(session_id)
    
    if processor and getattr(processor, 'filepath', None):
        filename_base = Path(processor.filepath).stem
    else:
        filename_base = f"{session_id}_demucs_input"
    
    # Try to locate the stem file (try both MP3 and WAV)
    demucs_output_dir = os.path.join(OUTPUT_FOLDER, session_id, "demucs", model, filename_base)
    stem_path_mp3 = os.path.join(demucs_output_dir, f"{name}.mp3")
    stem_path_wav = os.path.join(demucs_output_dir, f"{name}.wav")
    
    # Prefer MP3 if exists, fallback to WAV
    if os.path.exists(stem_path_mp3):
        stem_path = stem_path_mp3
        media_type = "audio/mpeg"
    elif os.path.exists(stem_path_wav):
        stem_path = stem_path_wav
        media_type = "audio/wav"
    else:
        raise HTTPException(
            status_code=404, 
            detail=f"Demucs stem '{name}' not found. Run /api/separate-demucs first."
        )
    
    return FileResponse(
        stem_path,
        media_type=media_type,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


# --- Human Voice Separation Endpoints ---

@app.post("/api/separate-human")
async def separate_human_voices(session_id: str, min_src: int = 2, max_src: int = 4):
    """
    Separate human voices using MultiDecoderDPRNN (Asteroid)
    
    Args:
        session_id: Active session ID
        min_src: Minimum number of speakers (default: 2)
        max_src: Maximum number of speakers (default: 4)
    
    Returns:
        dict: URLs to access separated speaker sources
    """
    processor = await get_session(session_id)
    
    # Get input file path
    input_path = None
    if getattr(processor, 'filepath', None):
        input_path = processor.filepath
    else:
        # Save current signal to temporary file
        tmp_input = os.path.join(UPLOAD_FOLDER, f"{session_id}_human_input.wav")
        save_signal(tmp_input, processor.original_data, processor.sample_rate)
        input_path = tmp_input
    
    # Output directory for separated voices
    human_output_dir = os.path.join(OUTPUT_FOLDER, session_id, "human_separation")
    os.makedirs(human_output_dir, exist_ok=True)
    
    try:
        # Initialize human voice separator
        separator = HumanVoiceSeparation()
        
        # Check if dependencies are installed
        if not separator.is_installed():
            raise HTTPException(
                status_code=500,
                detail="Human separation model not installed. Install required packages: pytorch-lightning, asteroid"
            )
        
        print(f"\n{'='*60}")
        print(f"🎤 HUMAN VOICE SEPARATION STARTED")
        print(f"   Session: {session_id}")
        print(f"   Input: {input_path}")
        print(f"   Min speakers: {min_src}, Max speakers: {max_src}")
        print(f"{'='*60}\n")
        
        # Perform separation
        sources = separator.separate(input_path, human_output_dir, min_src, max_src)
        
        # Build response with URLs to access sources
        source_urls = {}
        for source_name, source_path in sources.items():
            source_urls[source_name] = f"/stem-human?session_id={session_id}&name={source_name}"
        
        print(f"\n✓ Human voice separation completed!")
        print(f"   Generated {len(sources)} speakers: {list(sources.keys())}\n")
        
        return {
            'success': True,
            'message': f'Successfully separated audio into {len(sources)} speakers',
            'sources': source_urls,
            'num_speakers': len(sources)
        }
        
    except Exception as e:
        print(f"\n❌ Human voice separation failed: {str(e)}\n")
        raise HTTPException(status_code=500, detail=f"Human separation failed: {str(e)}")


@app.get("/api/stem-human")
async def get_human_stem(session_id: str, name: str):
    """
    Serve a separated human voice file
    
    Args:
        session_id: Session ID
        name: Speaker name (speaker_1, speaker_2, etc.)
    
    Returns:
        FileResponse: WAV audio file of the separated speaker
    """
    # Build path to source file
    filename_base = None
    processor = sessions.get(session_id)
    
    if processor and getattr(processor, 'filepath', None):
        filename_base = Path(processor.filepath).stem
    else:
        filename_base = f"{session_id}_human_input"
    
    # Try to locate the source file
    human_output_dir = os.path.join(OUTPUT_FOLDER, session_id, "human_separation")
    source_path = os.path.join(human_output_dir, f"{filename_base}_{name}.wav")
    
    if not os.path.exists(source_path):
        raise HTTPException(
            status_code=404,
            detail=f"Speaker '{name}' not found. Run /api/separate-human first."
        )
    
    return FileResponse(
        source_path,
        media_type="audio/wav",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


# --- Run the Server ---
if __name__ == "__main__":
    print("=" * 70)
    print("SIGNAL EQUALIZER - BACKEND SERVER (FastAPI)")
    print("=" * 70)
    print("\n🚀 Starting FastAPI server...")
    print(f"📁 Upload folder: {os.path.abspath(UPLOAD_FOLDER)}")
    print(f"📁 Output folder: {os.path.abspath(OUTPUT_FOLDER)}")
    print(f"📁 Config folder: {os.path.abspath(CONFIG_FOLDER)}")
    
    # 🚩 CRITICAL REMINDER
    print("\n" + "!"*70)
    print("! REMINDER: The function `frequency_bins` in `fft_implementation.py`")
    print("! in your provided code uses `np.fft.fftfreq`, which violates the")
    print("! project requirements.")
    print("! You MUST replace it with a custom implementation before submitting.")
    print("!"*70 + "\n")
    
    print("🌐 Server running on: http://localhost:8000")
    print("📚 API docs available at: http://localhost:8000/docs")
    print("=" * 70)
    print("\n✨ Ready for frontend connections!\n")
    
    # This runs the server. 'reload=True' auto-restarts on code changes.
    # Note: Use "backend.api.main:app" because of your folder structure
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
