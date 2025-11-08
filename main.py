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

# --- File Paths ---
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"
CONFIG_FOLDER = "configs"
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
    signal = processor.data # .data holds the *current* processed signal
    
    if signal is None:
        signal = processor.original_data
    
    # Downsample
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
        'length': len(processor.data),
        'start': 0,
        'end': len(processor.data)
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


























# import uvicorn
# import numpy as np
# import os
# from fastapi import FastAPI, File, UploadFile, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from typing import List, Optional, Dict, Any

# # --- Import Your Custom Modules ---
# # This assumes main.py is in the 'api' folder,
# # and your core modules are in the 'core' folder
# # (as shown in your project structure image)
# from core.equalizer_core import SignalProcessor
# from core.fft_implementation import fft_magnitude, fft_phase, frequency_bins

# # --- Pydantic Models (for API validation) ---
# # These define the data structures for your API requests and responses

# class Slider(BaseModel):
#     """Defines the structure for a single slider from the frontend"""
#     center_freq: float
#     width: float
#     gain: float

# class ProcessRequest(BaseModel):
#     """Defines the request body for the /process endpoint"""
#     sliders: List[Slider]

# class SignalInfoResponse(BaseModel):
#     """Defines the info returned on file upload"""
#     filepath: Optional[str]
#     sample_rate: int
#     duration_seconds: float
#     length_samples: int
#     frequency_range_hz: tuple
        
# class InitialDataResponse(BaseModel):
#     """Defines the data sent to the frontend on initial load"""
#     info: SignalInfoResponse
#     original_signal: List[float] # Send as list for JSON
#     frequencies: List[float]
#     magnitudes: List[float]
#     phases: List[float]

# class ProcessResponse(BaseModel):
#     """Defines the data sent after applying the equalizer"""
#     output_signal: List[float]
#     modified_magnitudes: List[float]
#     modified_phases: List[float]

# # --- FastAPI App Initialization ---
# app = FastAPI(
#     title="Signal Equalizer API",
#     description="Backend for the DSP project, built by Student 1's core."
# )

# # --- Add CORS Middleware ---
# # This is CRITICAL for your React frontend (on localhost:3000)
# # to be able to talk to this server (on localhost:8000).
# origins = [
#     "http://localhost:3000", # React's default dev server
# ]
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=origins,
#     allow_credentials=True,
#     allow_methods=["*"], # Allow all methods (GET, POST, etc.)
#     allow_headers=["*"],
# )

# # --- Global Signal Processor ---
# # This will hold the *one* signal we are working on.
# processor: Optional[SignalProcessor] = None

# # --- Temp File Handling ---
# # We need a place to save the uploaded file temporarily
# TEMP_FILE_DIR = "temp_uploads"
# os.makedirs(TEMP_FILE_DIR, exist_ok=True)
# # This app will only handle one signal at a time
# TEMP_FILE_PATH = os.path.join(TEMP_FILE_DIR, "current_signal.wav") 

# # --- API Endpoints ---

# @app.post("/upload", response_model=SignalInfoResponse)
# async def upload_audio_file(file: UploadFile = File(...)):
#     """
#     Uploads an audio file and initializes the SignalProcessor.
#     This is the first endpoint the frontend should call.
#     """
#     global processor
    
#     try:
#         # Save the uploaded file, overwriting any previous one
#         with open(TEMP_FILE_PATH, "wb") as buffer:
#             buffer.write(await file.read())
            
#         # Initialize the processor with this file
#         processor = SignalProcessor(TEMP_FILE_PATH)
        
#         info = processor.get_info()
#         return SignalInfoResponse(**info)
        
#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

# @app.get("/initial-data", response_model=InitialDataResponse)
# async def get_initial_data():
#     """
#     Gets all the data needed for the frontend to initialize its graphs:
#     1. Original signal waveform (for Student 2)
#     2. Original FFT data (freqs, mags, phases) (for Student 3)
#     """
#     global processor
#     if processor is None:
#         raise HTTPException(status_code=400, detail="No signal uploaded. Please upload a file first.")
        
#     try:
#         # 1. Get info
#         info = processor.get_info()
        
#         # 2. Get original signal
#         # We must convert numpy arrays to lists to send as JSON
#         original_signal = processor.original_data.tolist()
        
#         # 3. Get FFT data
#         freqs, mags, phases = processor.compute_fft()
        
#         return InitialDataResponse(
#             info=SignalInfoResponse(**info),
#             original_signal=original_signal,
#             frequencies=freqs.tolist(),
#             magnitudes=mags.tolist(),
#             phases=phases.tolist()
#         )
#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=f"Failed to get initial data: {str(e)}")

# @app.post("/process", response_model=ProcessResponse)
# async def process_signal_with_sliders(request: ProcessRequest):
#     """
#     The main equalization endpoint.
#     Receives slider settings (from Student 4), applies them, 
#     and returns the *new* signal (for Student 2) and 
#     *new* FFT data (for Student 3).
#     """
#     global processor
#     if processor is None:
#         raise HTTPException(status_code=400, detail="No signal loaded. Please upload a file first.")

#     try:
#         # Convert Pydantic models to simple dicts for your processor
#         slider_list = [s.model_dump() for s in request.sliders]
        
#         # 1. Create the gain array from slider data
#         gain_array = processor.create_gain_array_from_sliders(slider_list)
        
#         # 2. Apply the gain
#         modified_freq_domain = processor.apply_frequency_gain(gain_array)
        
#         # 3. Reconstruct the time-domain signal
#         output_signal = processor.reconstruct_signal()
        
#         # 4. Get the *new* magnitudes and phases for the output graph
#         # We re-use your custom fft_magnitude/phase functions here
#         modified_mags = fft_magnitude(modified_freq_domain).tolist()
#         modified_phases = fft_phase(modified_freq_domain).tolist()
        
#         return ProcessResponse(
#             output_signal=output_signal.tolist(),
#             modified_magnitudes=modified_mags,
#             modified_phases=modified_phases
#         )
#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=f"Failed to process signal: {str(e)}")

# @app.post("/reset", status_code=200)
# async def reset_processor():
#     """
#     Resets the equalizer to the original, unmodified signal.
#     """
#     global processor
#     if processor is None:
#         raise HTTPException(status_code=400, detail="No signal loaded.")
        
#     try:
#         processor.reset()
#         # After resetting, just return a success message.
#         # The frontend should then call /initial-data again to get the fresh data.
#         return {"message": "Processor reset successfully. Please recall /initial-data."}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to reset: {str(e)}")

# # --- Run the Server ---
# if __name__ == "__main__":
#     print("--- Starting Signal Equalizer Backend (FastAPI) ---")
    
#     # 🚩 CRITICAL REMINDER
#     print("\n" + "!"*70)
#     print("! REMINDER: The function `frequency_bins` in `fft_implementation.py`")
#     print("! uses `np.fft.fftfreq`, which violates the project requirements.")
#     print("! You MUST replace it with a custom implementation before submitting.")
#     print("!"*70 + "\n")
    
#     print("Starting server... Access the API docs at http://localhost:8000/docs")
#     # This runs the server. 'reload=True' means it will auto-restart
#     # when you save changes to this file.
#     uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)






























# """
# Main Flask Backend Server - Signal Equalizer
# Connects Student 1's DSP engine to the web frontend (Students 2, 3, 4)

# This server provides REST API endpoints for:
# - Loading audio files
# - Computing FFT
# - Applying frequency gains
# - Reconstructing signals
# - Saving output
# - Managing sessions
# """

# from flask import Flask, request, jsonify, send_file, send_from_directory
# from flask_cors import CORS
# import numpy as np
# import os
# import tempfile
# import uuid
# import base64
# from io import BytesIO
# import json
# from pathlib import Path

# # Import Student 1's DSP engine
# from backend.equalizer_core import SignalProcessor, create_synthetic_test_signal
# from backend.signal_io import save_signal

# # Initialize Flask app
# app = Flask(__name__, static_folder='../frontend', static_url_path='')
# CORS(app)  # Enable CORS for frontend requests

# # Configuration
# UPLOAD_FOLDER = Path('uploads')
# OUTPUT_FOLDER = Path('outputs')
# UPLOAD_FOLDER.mkdir(exist_ok=True)
# OUTPUT_FOLDER.mkdir(exist_ok=True)

# app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
# app.config['OUTPUT_FOLDER'] = str(OUTPUT_FOLDER)
# app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# # Session storage (in production, use Redis or database)
# sessions = {}


# # ============================================================================
# # Helper Functions
# # ============================================================================

# def get_or_create_session(session_id=None):
#     """Get existing session or create new one."""
#     if session_id and session_id in sessions:
#         return session_id, sessions[session_id]
    
#     # Create new session
#     new_session_id = str(uuid.uuid4())
#     sessions[new_session_id] = {
#         'processor': None,
#         'frequencies': None,
#         'magnitudes': None,
#         'phases': None,
#         'input_filepath': None,
#         'output_filepath': None
#     }
#     return new_session_id, sessions[new_session_id]


# def numpy_to_list(arr):
#     """Convert numpy array to list for JSON serialization."""
#     if isinstance(arr, np.ndarray):
#         return arr.tolist()
#     return arr


# def serialize_signal_data(data, max_points=10000):
#     """
#     Downsample signal data for efficient transfer to frontend.
#     For long signals, send decimated version for display.
#     """
#     if len(data) <= max_points:
#         return numpy_to_list(data)
    
#     # Downsample by taking every Nth point
#     step = len(data) // max_points
#     return numpy_to_list(data[::step])


# # ============================================================================
# # API Endpoints
# # ============================================================================

# @app.route('/')
# def index():
#     """Serve the main HTML page."""
#     return send_from_directory(app.static_folder, 'index.html')


# @app.route('/api/health', methods=['GET'])
# def health_check():
#     """Health check endpoint."""
#     return jsonify({
#         'status': 'ok',
#         'message': 'Signal Equalizer Backend is running',
#         'active_sessions': len(sessions)
#     })


# @app.route('/api/upload', methods=['POST'])
# def upload_file():
#     """
#     Upload audio file and initialize signal processor.
    
#     Request:
#         - multipart/form-data with 'file' field
#         - Optional: session_id
    
#     Response:
#         - session_id: Unique session identifier
#         - filename: Original filename
#         - sample_rate: Sampling rate in Hz
#         - duration: Duration in seconds
#         - length: Number of samples
#         - message: Status message
#     """
#     try:
#         # Check if file is in request
#         if 'file' not in request.files:
#             return jsonify({'error': 'No file provided'}), 400
        
#         file = request.files['file']
        
#         if file.filename == '':
#             return jsonify({'error': 'Empty filename'}), 400
        
#         # Get or create session
#         session_id = request.form.get('session_id')
#         session_id, session = get_or_create_session(session_id)
        
#         # Save uploaded file
#         filename = f"{session_id}_{file.filename}"
#         filepath = UPLOAD_FOLDER / filename
#         file.save(str(filepath))
        
#         # Initialize processor
#         processor = SignalProcessor(str(filepath))
        
#         # Store in session
#         session['processor'] = processor
#         session['input_filepath'] = str(filepath)
        
#         # Get signal info
#         info = processor.get_info()
        
#         return jsonify({
#             'session_id': session_id,
#             'filename': file.filename,
#             'sample_rate': info['sample_rate'],
#             'duration': info['duration_seconds'],
#             'length': info['length_samples'],
#             'message': 'File uploaded and processed successfully'
#         })
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/synthetic', methods=['POST'])
# def create_synthetic():
#     """
#     Create synthetic test signal.
    
#     Request JSON:
#         {
#             "frequencies": [100, 500, 1000, 2000],
#             "duration": 2.0,
#             "sample_rate": 44100
#         }
    
#     Response:
#         - session_id: Unique session identifier
#         - sample_rate: Sampling rate
#         - duration: Duration in seconds
#         - frequencies: List of frequencies created
#     """
#     try:
#         data = request.json
        
#         frequencies = data.get('frequencies', [100, 500, 1000, 2000])
#         duration = data.get('duration', 2.0)
#         sample_rate = data.get('sample_rate', 44100)
        
#         # Create synthetic signal
#         signal, sr = create_synthetic_test_signal(frequencies, duration, sample_rate)
        
#         # Get or create session
#         session_id = request.form.get('session_id') if request.form else None
#         session_id, session = get_or_create_session(session_id)
        
#         # Initialize processor with synthetic signal
#         processor = SignalProcessor()
#         processor.set_signal(signal, sr)
        
#         session['processor'] = processor
        
#         return jsonify({
#             'session_id': session_id,
#             'sample_rate': sr,
#             'duration': duration,
#             'frequencies': frequencies,
#             'length': len(signal),
#             'message': 'Synthetic signal created successfully'
#         })
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/signal/input', methods=['GET'])
# def get_input_signal():
#     """
#     Get input signal data for display.
    
#     Query params:
#         - session_id: Required
#         - start: Start sample index (optional)
#         - end: End sample index (optional)
#         - max_points: Maximum points to return (default: 10000)
    
#     Response:
#         - signal: Array of amplitude values
#         - sample_rate: Sampling rate
#         - length: Total length of signal
#         - time_axis: Time values in seconds
#     """
#     try:
#         session_id = request.args.get('session_id')
        
#         if not session_id or session_id not in sessions:
#             return jsonify({'error': 'Invalid session_id'}), 400
        
#         session = sessions[session_id]
#         processor = session['processor']
        
#         if processor is None:
#             return jsonify({'error': 'No signal loaded'}), 400
        
#         # Get parameters
#         start = int(request.args.get('start', 0))
#         end = int(request.args.get('end', len(processor.original_data)))
#         max_points = int(request.args.get('max_points', 10000))
        
#         # Get signal slice
#         signal = processor.original_data[start:end]
        
#         # Downsample if too many points
#         if len(signal) > max_points:
#             step = len(signal) // max_points
#             signal = signal[::step]
#             actual_start = start
#             actual_end = start + len(signal) * step
#         else:
#             actual_start = start
#             actual_end = end
        
#         # Create time axis
#         time_axis = np.arange(actual_start, actual_start + len(signal)) / processor.sample_rate
        
#         return jsonify({
#             'signal': numpy_to_list(signal),
#             'time_axis': numpy_to_list(time_axis),
#             'sample_rate': processor.sample_rate,
#             'length': len(processor.original_data),
#             'start': actual_start,
#             'end': actual_end
#         })
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/signal/output', methods=['GET'])
# def get_output_signal():
#     """
#     Get output (processed) signal data for display.
    
#     Query params: Same as /api/signal/input
#     """
#     try:
#         session_id = request.args.get('session_id')
        
#         if not session_id or session_id not in sessions:
#             return jsonify({'error': 'Invalid session_id'}), 400
        
#         session = sessions[session_id]
#         processor = session['processor']
        
#         if processor is None or processor.data is None:
#             return jsonify({'error': 'No processed signal available'}), 400
        
#         # Get parameters
#         start = int(request.args.get('start', 0))
#         end = int(request.args.get('end', len(processor.data)))
#         max_points = int(request.args.get('max_points', 10000))
        
#         # Get signal slice
#         signal = processor.data[start:end]
        
#         # Downsample if too many points
#         if len(signal) > max_points:
#             step = len(signal) // max_points
#             signal = signal[::step]
#             actual_start = start
#             actual_end = start + len(signal) * step
#         else:
#             actual_start = start
#             actual_end = end
        
#         # Create time axis
#         time_axis = np.arange(actual_start, actual_start + len(signal)) / processor.sample_rate
        
#         return jsonify({
#             'signal': numpy_to_list(signal),
#             'time_axis': numpy_to_list(time_axis),
#             'sample_rate': processor.sample_rate,
#             'length': len(processor.data),
#             'start': actual_start,
#             'end': actual_end
#         })
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/fft/compute', methods=['POST'])
# def compute_fft():
#     """
#     Compute FFT of the loaded signal.
    
#     Request JSON:
#         {
#             "session_id": "uuid"
#         }
    
#     Response:
#         - frequencies: Array of frequency values in Hz
#         - magnitudes: Array of magnitude values
#         - phases: Array of phase values in radians
#         - positive_only: Option to return only positive frequencies
#     """
#     try:
#         data = request.json
#         session_id = data.get('session_id')
        
#         if not session_id or session_id not in sessions:
#             return jsonify({'error': 'Invalid session_id'}), 400
        
#         session = sessions[session_id]
#         processor = session['processor']
        
#         if processor is None:
#             return jsonify({'error': 'No signal loaded'}), 400
        
#         # Compute FFT
#         frequencies, magnitudes, phases = processor.compute_fft()
        
#         # Store in session
#         session['frequencies'] = frequencies
#         session['magnitudes'] = magnitudes
#         session['phases'] = phases
        
#         # Option to return only positive frequencies
#         positive_only = data.get('positive_only', True)
        
#         if positive_only:
#             positive_mask = frequencies >= 0
#             frequencies = frequencies[positive_mask]
#             magnitudes = magnitudes[positive_mask]
#             phases = phases[positive_mask]
        
#         return jsonify({
#             'frequencies': numpy_to_list(frequencies),
#             'magnitudes': numpy_to_list(magnitudes),
#             'phases': numpy_to_list(phases),
#             'length': len(frequencies)
#         })
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/process', methods=['POST'])
# def process_signal():
#     """
#     Apply frequency gain and reconstruct signal.
    
#     Request JSON:
#         {
#             "session_id": "uuid",
#             "sliders": [
#                 {
#                     "id": 1,
#                     "center_freq": 1000,
#                     "width": 200,
#                     "gain": 1.5
#                 }
#             ]
#         }
#         OR
#         {
#             "session_id": "uuid",
#             "gain_array": [1.0, 1.0, 1.5, ...]
#         }
    
#     Response:
#         - message: Status message
#         - output_length: Length of reconstructed signal
#         - frequencies: Updated frequency spectrum
#         - magnitudes: Updated magnitude spectrum
#     """
#     try:
#         data = request.json
#         session_id = data.get('session_id')
        
#         if not session_id or session_id not in sessions:
#             return jsonify({'error': 'Invalid session_id'}), 400
        
#         session = sessions[session_id]
#         processor = session['processor']
        
#         if processor is None:
#             return jsonify({'error': 'No signal loaded'}), 400
        
#         # Ensure FFT is computed
#         if processor.freq_domain is None:
#             processor.compute_fft()
        
#         # Get gain array
#         if 'sliders' in data:
#             # Convert sliders to gain array
#             sliders = data['sliders']
#             gain_array = processor.create_gain_array_from_sliders(sliders)
#         elif 'gain_array' in data:
#             # Use provided gain array
#             gain_array = np.array(data['gain_array'])
#         else:
#             return jsonify({'error': 'No gain information provided'}), 400
        
#         # Apply gain
#         processor.apply_frequency_gain(gain_array)
        
#         # Reconstruct signal
#         output_signal = processor.reconstruct_signal()
        
#         # Get updated spectrum
#         frequencies, magnitudes, phases = processor.compute_fft()
        
#         # Update session
#         session['magnitudes'] = magnitudes
#         session['phases'] = phases
        
#         # Return updated spectrum (positive frequencies only)
#         positive_mask = frequencies >= 0
        
#         return jsonify({
#             'message': 'Signal processed successfully',
#             'output_length': len(output_signal),
#             'frequencies': numpy_to_list(frequencies[positive_mask]),
#             'magnitudes': numpy_to_list(magnitudes[positive_mask]),
#             'max_magnitude': float(np.max(np.abs(output_signal)))
#         })
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/save', methods=['POST'])
# def save_output():
#     """
#     Save processed signal to file.
    
#     Request JSON:
#         {
#             "session_id": "uuid",
#             "filename": "output.wav"  (optional)
#         }
    
#     Response:
#         - download_url: URL to download the file
#         - filename: Output filename
#         - message: Status message
#     """
#     try:
#         data = request.json
#         session_id = data.get('session_id')
        
#         if not session_id or session_id not in sessions:
#             return jsonify({'error': 'Invalid session_id'}), 400
        
#         session = sessions[session_id]
#         processor = session['processor']
        
#         if processor is None or processor.data is None:
#             return jsonify({'error': 'No processed signal available'}), 400
        
#         # Generate filename
#         filename = data.get('filename', f'output_{session_id[:8]}.wav')
#         output_path = OUTPUT_FOLDER / filename
        
#         # Save signal
#         processor.save_output(str(output_path))
        
#         session['output_filepath'] = str(output_path)
        
#         return jsonify({
#             'download_url': f'/api/download/{filename}',
#             'filename': filename,
#             'message': 'File saved successfully'
#         })
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/download/<filename>', methods=['GET'])
# def download_file(filename):
#     """Download saved output file."""
#     try:
#         return send_from_directory(app.config['OUTPUT_FOLDER'], filename, as_attachment=True)
#     except Exception as e:
#         return jsonify({'error': str(e)}), 404


# @app.route('/api/session/info', methods=['GET'])
# def get_session_info():
#     """
#     Get information about current session.
    
#     Query params:
#         - session_id: Required
#     """
#     try:
#         session_id = request.args.get('session_id')
        
#         if not session_id or session_id not in sessions:
#             return jsonify({'error': 'Invalid session_id'}), 400
        
#         session = sessions[session_id]
#         processor = session['processor']
        
#         if processor is None:
#             return jsonify({
#                 'session_id': session_id,
#                 'status': 'empty',
#                 'message': 'No signal loaded'
#             })
        
#         info = processor.get_info()
        
#         return jsonify({
#             'session_id': session_id,
#             'status': 'active',
#             **info
#         })
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/config/save', methods=['POST'])
# def save_config():
#     """
#     Save equalizer configuration.
    
#     Request JSON:
#         {
#             "session_id": "uuid",
#             "config_name": "my_preset",
#             "config": {
#                 "mode": "generic",
#                 "sliders": [...]
#             }
#         }
#     """
#     try:
#         data = request.json
#         config_name = data.get('config_name', 'preset')
#         config = data.get('config', {})
        
#         # Save to file
#         config_dir = Path('configs')
#         config_dir.mkdir(exist_ok=True)
        
#         config_path = config_dir / f'{config_name}.json'
        
#         with open(config_path, 'w') as f:
#             json.dump(config, f, indent=2)
        
#         return jsonify({
#             'message': 'Configuration saved successfully',
#             'config_path': str(config_path)
#         })
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/config/load', methods=['GET'])
# def load_config():
#     """
#     Load equalizer configuration.
    
#     Query params:
#         - config_name: Name of configuration to load
#     """
#     try:
#         config_name = request.args.get('config_name')
        
#         if not config_name:
#             return jsonify({'error': 'config_name required'}), 400
        
#         config_path = Path('configs') / f'{config_name}.json'
        
#         if not config_path.exists():
#             return jsonify({'error': 'Configuration not found'}), 404
        
#         with open(config_path, 'r') as f:
#             config = json.load(f)
        
#         return jsonify({
#             'config': config,
#             'config_name': config_name,
#             'message': 'Configuration loaded successfully'
#         })
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/config/list', methods=['GET'])
# def list_configs():
#     """List all saved configurations."""
#     try:
#         config_dir = Path('configs')
        
#         if not config_dir.exists():
#             return jsonify({'configs': []})
        
#         configs = [f.stem for f in config_dir.glob('*.json')]
        
#         return jsonify({'configs': configs})
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/reset', methods=['POST'])
# def reset_signal():
#     """
#     Reset signal to original state.
    
#     Request JSON:
#         {
#             "session_id": "uuid"
#         }
#     """
#     try:
#         data = request.json
#         session_id = data.get('session_id')
        
#         if not session_id or session_id not in sessions:
#             return jsonify({'error': 'Invalid session_id'}), 400
        
#         session = sessions[session_id]
#         processor = session['processor']
        
#         if processor is None:
#             return jsonify({'error': 'No signal loaded'}), 400
        
#         processor.reset()
        
#         return jsonify({'message': 'Signal reset to original state'})
    
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# # ============================================================================
# # Error Handlers
# # ============================================================================

# @app.errorhandler(413)
# def request_entity_too_large(error):
#     """Handle file too large error."""
#     return jsonify({'error': 'File too large. Maximum size is 100MB.'}), 413


# @app.errorhandler(404)
# def not_found(error):
#     """Handle 404 errors."""
#     return jsonify({'error': 'Endpoint not found'}), 404


# @app.errorhandler(500)
# def internal_error(error):
#     """Handle internal server errors."""
#     return jsonify({'error': 'Internal server error'}), 500


# # ============================================================================
# # Main Entry Point
# # ============================================================================

# if __name__ == '__main__':
#     print("=" * 70)
#     print("SIGNAL EQUALIZER - BACKEND SERVER")
#     print("=" * 70)
#     print("\n🚀 Starting Flask server...")
#     print(f"📁 Upload folder: {UPLOAD_FOLDER.absolute()}")
#     print(f"📁 Output folder: {OUTPUT_FOLDER.absolute()}")
#     print("\n📡 API Endpoints:")
#     print("   POST   /api/upload          - Upload audio file")
#     print("   POST   /api/synthetic       - Create synthetic signal")
#     print("   GET    /api/signal/input    - Get input signal data")
#     print("   GET    /api/signal/output   - Get output signal data")
#     print("   POST   /api/fft/compute     - Compute FFT")
#     print("   POST   /api/process         - Apply gain and reconstruct")
#     print("   POST   /api/save            - Save output file")
#     print("   GET    /api/download/<file> - Download saved file")
#     print("   GET    /api/session/info    - Get session info")
#     print("   POST   /api/config/save     - Save configuration")
#     print("   GET    /api/config/load     - Load configuration")
#     print("   GET    /api/config/list     - List configurations")
#     print("   POST   /api/reset           - Reset to original signal")
#     print("\n🌐 Server running on: http://localhost:5000")
#     print("=" * 70)
#     print("\n✨ Ready for frontend connections!\n")
    
#     # Run server
#     app.run(
#         host='0.0.0.0',
#         port=5000,
#         debug=True,
#         threaded=True
#     )
