import uvicorn
import numpy as np
import os
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid

# --- Import Your Custom Modules ---
# This matches your project structure image (api/ and core/ folders)
from backend.equalizer_core import SignalProcessor, create_synthetic_test_signal
from backend.fft_implementation import fft_magnitude, fft_phase
from backend.signal_io import save_signal

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

class SignalDataResponse(BaseModel):
    """Defines the data for the time-domain signal viewers"""
    signal: List[float]
    time_axis: List[float]
    sample_rate: int
    length: int
    start: int
    end: int

class SpectrogramResponse(BaseModel):
    """Defines the data for spectrogram visualization"""
    times: List[float]
    frequencies: List[float]
    magnitude: List[List[float]]  # 2D array: [time_index][freq_index]
    sample_rate: int

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
    "http://localhost:3001", # Alternative React dev server port
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

# --- File Paths ---
# Use absolute paths to avoid issues with working directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "outputs")
CONFIG_FOLDER = os.path.join(BASE_DIR, "configs")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(CONFIG_FOLDER, exist_ok=True)


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
    """
    global sessions
    
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
        
        # Store in session
        sessions[session_id] = processor
        
        # Get signal info
        info = processor.get_info()
        
        return {
            'session_id': session_id,
            'filename': file.filename,
            'sample_rate': info['sample_rate'],
            'duration': info['duration_seconds'],
            'length': info['length_samples'],
            'message': 'File uploaded and processed successfully'
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
    Returns the FFT of the OUTPUT (processed) signal.
    Uses the modified frequency domain directly (more accurate than FFT->IFFT->FFT).
    Use this to compare frequency spectrum before/after processing.
    """
    processor = await get_session(session_id)
    
    # Check if modified frequency domain exists (created after processing)
    if processor.modified_freq_domain is None:
        raise HTTPException(status_code=400, detail="No output signal available. Process signal first.")
    
    # Use the modified frequency domain directly (already computed, more accurate)
    import numpy as np
    
    frequencies = processor.frequencies
    magnitudes = np.abs(processor.modified_freq_domain)
    phases = np.angle(processor.modified_freq_domain)
    
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

@app.post("/api/process", response_model=ProcessResponse)
async def process_signal(request: ProcessRequest):
    """
    Applies gain from sliders and reconstructs the signal.
    This is the main "real-time" loop endpoint.
    """
    processor = await get_session(request.session_id)
    
    # Ensure FFT is computed
    if processor.freq_domain is None:
        processor.compute_fft()
        
    # Get gain array
    slider_list = [s.model_dump() for s in request.sliders]
    gain_array = processor.create_gain_array_from_sliders(slider_list)
    
    # Apply gain
    modified_freq_domain = processor.apply_frequency_gain(gain_array)
    
    # Reconstruct signal
    output_signal = processor.reconstruct_signal()
    
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

@app.get("/api/signal/input", response_model=SignalDataResponse)
async def get_input_signal(session_id: str, max_points: int = 10000, full: bool = False):
    """
    Gets the input signal waveform.
    
    Args:
        session_id: Session identifier
        max_points: Maximum points to return (for visualization)
        full: If True, return full signal without downsampling (for audio playback)
    """
    processor = await get_session(session_id)
    signal = processor.original_data
    
    # Full signal for audio playback
    if full:
        time_axis = np.arange(len(signal)) / processor.sample_rate
        return {
            'signal': signal.tolist(),
            'time_axis': time_axis.tolist(),
            'sample_rate': processor.sample_rate,
            'length': len(signal),
            'start': 0,
            'end': len(signal)
        }
    
    # Downsample for frontend performance (charts)
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
async def get_output_signal(session_id: str, max_points: int = 10000, full: bool = False):
    """
    Gets the output (processed) signal waveform.
    
    Args:
        session_id: Session identifier
        max_points: Maximum points to return (for visualization)
        full: If True, return full signal without downsampling (for audio playback)
    """
    processor = await get_session(session_id)
    # processor.data holds the current (processed) signal
    signal = processor.data
    
    if signal is None:
        signal = processor.original_data
    
    # Full signal for audio playback
    if full:
        time_axis = np.arange(len(signal)) / processor.sample_rate
        return {
            'signal': signal.tolist(),
            'time_axis': time_axis.tolist(),
            'sample_rate': processor.sample_rate,
            'length': len(signal),
            'start': 0,
            'end': len(signal)
        }
    
    # Downsample for charts
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
        'length': len(processor.data if processor.data is not None else processor.original_data),
        'start': 0,
        'end': len(processor.data if processor.data is not None else processor.original_data)
    }

@app.get("/api/spectrogram/input", response_model=SpectrogramResponse)
async def get_input_spectrogram(session_id: str, window_size: int = 1024, overlap: float = 0.75):
    """
    Computes and returns the spectrogram of the INPUT signal.
    
    Args:
        session_id: Session identifier
        window_size: Size of FFT window (samples)
        overlap: Overlap ratio between windows (0.0 to 1.0)
    """
    processor = await get_session(session_id)
    
    if processor.original_data is None:
        raise HTTPException(status_code=400, detail="No input signal available")
    
    from backend.fft_implementation import rfft, rfftfreq
    
    signal = processor.original_data
    sample_rate = processor.sample_rate
    hop_size = int(window_size * (1 - overlap))
    
    # Calculate number of windows
    num_windows = (len(signal) - window_size) // hop_size + 1
    
    # Initialize spectrogram array
    spectrogram = []
    times = []
    
    for i in range(num_windows):
        start = i * hop_size
        end = start + window_size
        
        if end > len(signal):
            break
            
        window = signal[start:end]
        
        # Apply Hann window
        hann = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(window_size) / window_size)
        windowed = window * hann
        
        # Use rfft for real signals - returns only positive frequencies
        # This matches rfftfreq output and gives correct frequency ordering
        fft_result = rfft(windowed, pad=False)
        magnitude = np.abs(fft_result)
        
        # Reverse magnitude array so plotting shows low freq at bottom, high freq at top
        spectrogram.append(magnitude[::-1].tolist())
        times.append(start / sample_rate)
    
    # Frequency axis - reversed to match reversed magnitude data
    frequencies = rfftfreq(window_size, 1/sample_rate)[::-1]
    
    return {
        'times': times,
        'frequencies': frequencies.tolist(),
        'magnitude': spectrogram,
        'sample_rate': sample_rate
    }

@app.get("/api/spectrogram/output", response_model=SpectrogramResponse)
async def get_output_spectrogram(session_id: str, window_size: int = 1024, overlap: float = 0.75):
    """
    Computes and returns the spectrogram of the OUTPUT (processed) signal.
    
    Args:
        session_id: Session identifier
        window_size: Size of FFT window (samples)
        overlap: Overlap ratio between windows (0.0 to 1.0)
    """
    processor = await get_session(session_id)
    
    # Use processed data if available, otherwise fall back to original
    signal = processor.data if processor.data is not None else processor.original_data
    
    if signal is None:
        raise HTTPException(status_code=400, detail="No output signal available")
    
    from backend.fft_implementation import rfft, rfftfreq
    
    sample_rate = processor.sample_rate
    hop_size = int(window_size * (1 - overlap))
    
    # Calculate number of windows
    num_windows = (len(signal) - window_size) // hop_size + 1
    
    # Initialize spectrogram array
    spectrogram = []
    times = []
    
    # Check if signal is very weak (heavily muted)
    signal_peak = np.max(np.abs(signal))
    use_db_scale = signal_peak < 0.1  # Use dB for weak signals
    
    for i in range(num_windows):
        start = i * hop_size
        end = start + window_size
        
        if end > len(signal):
            break
            
        window = signal[start:end]
        
        # Apply Hann window
        hann = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(window_size) / window_size)
        windowed = window * hann
        
        # Use rfft for real signals - returns only positive frequencies
        # This matches rfftfreq output and gives correct frequency ordering
        fft_result = rfft(windowed, pad=False)
        magnitude = np.abs(fft_result)
        
        # For very weak signals, use dB scale for better visibility
        if use_db_scale:
            # Convert to dB: 20*log10(mag), clamp minimum to -100 dB
            magnitude = np.maximum(20 * np.log10(magnitude + 1e-10), -100)
        
        # Reverse magnitude array so plotting shows low freq at bottom, high freq at top
        spectrogram.append(magnitude[::-1].tolist())
        times.append(start / sample_rate)
    
    # Frequency axis - reversed to match reversed magnitude data
    frequencies = rfftfreq(window_size, 1/sample_rate)[::-1]
    
    return {
        'times': times,
        'frequencies': frequencies.tolist(),
        'magnitude': spectrogram,
        'sample_rate': sample_rate
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
    
    # Sanitize filename to prevent directory traversal
    safe_name = "".join(c for c in config_name if c.isalnum() or c in (' ', '-', '_')).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid configuration name")
    
    config_path = os.path.join(CONFIG_FOLDER, f"{safe_name}.json")
    
    try:
        # Ensure config folder exists
        os.makedirs(CONFIG_FOLDER, exist_ok=True)
        
        with open(config_path, 'w') as f:
            import json
            json.dump(config, f, indent=2)
        
        print(f"✓ Configuration saved: {config_path}")
        
        return {
            'message': 'Configuration saved successfully',
            'config_path': str(config_path)
        }
    except Exception as e:
        print(f"✗ Failed to save configuration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save configuration: {str(e)}")

@app.get("/api/config/load")
async def load_config(config_name: str):
    """Loads a slider configuration from a JSON file."""
    # Sanitize filename
    safe_name = "".join(c for c in config_name if c.isalnum() or c in (' ', '-', '_')).strip()
    config_path = os.path.join(CONFIG_FOLDER, f"{safe_name}.json")
    
    if not os.path.exists(config_path):
        print(f"✗ Configuration not found: {config_path}")
        raise HTTPException(status_code=404, detail="Configuration not found")
        
    try:
        with open(config_path, 'r') as f:
            import json
            config = json.load(f)
        
        print(f"✓ Configuration loaded: {config_path}")
        
        return {
            'config': config,
            'config_name': config_name,
            'message': 'Configuration loaded successfully'
        }
    except Exception as e:
        print(f"✗ Failed to load configuration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to load configuration: {str(e)}")

@app.get("/api/config/list")
async def list_configs():
    """Lists all available .json configuration files."""
    try:
        # Ensure config folder exists
        os.makedirs(CONFIG_FOLDER, exist_ok=True)
        
        configs = [f.replace('.json', '') for f in os.listdir(CONFIG_FOLDER) if f.endswith('.json')]
        
        print(f"✓ Found {len(configs)} saved configurations")
        
        return {'configs': configs}
    except Exception as e:
        print(f"✗ Failed to list configurations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list configurations: {str(e)}")


# --- Run the Server ---
if __name__ == "__main__":
    print("=" * 70)
    print("SIGNAL EQUALIZER - BACKEND SERVER (FastAPI)")
    print("=" * 70)
    print("\n🚀 Starting FastAPI server...")
    print(f"📁 Upload folder: {os.path.abspath(UPLOAD_FOLDER)}")
    print(f"📁 Output folder: {os.path.abspath(OUTPUT_FOLDER)}")
    print(f"📁 Config folder: {os.path.abspath(CONFIG_FOLDER)}")
    
    # ✅ All custom FFT implementations ready (no numpy.fft dependencies)
    print("\n" + "="*70)
    print("✅ Custom FFT Implementation Status:")
    print("   • frequency_bins() - Custom implementation (FFT output order)")
    print("   • rfftfreq() - Custom implementation (positive frequencies)")
    print("   • rfft/irfft - Optimized for real audio signals")
    print("   • Phase preservation - Explicit magnitude/phase handling")
    print("   • 100% project compliance - Zero numpy.fft usage")
    print("="*70 + "\n")
    
    print("🌐 Server running on: http://localhost:8000")
    print("📚 API docs available at: http://localhost:8000/docs")
    print("=" * 70)
    print("\n✨ Ready for frontend connections!\n")
    
    # This runs the server. 'reload=True' auto-restarts on code changes.
    # Note: Use "backend.api.main:app" because of your folder structure
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

