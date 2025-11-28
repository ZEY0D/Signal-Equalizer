"""
Human Voice Separation using MultiDecoderDPRNN (Asteroid)
Separates mixed human voices into individual speakers
"""
import torch
import soundfile as sf
import os
import sys
import importlib.util
import numpy as np
from pathlib import Path

# Patch for asteroid compatibility with newer huggingface_hub
try:
    import huggingface_hub
    # Patch cached_download if it doesn't exist (moved to hf_hub_download in newer versions)
    if not hasattr(huggingface_hub, 'cached_download'):
        from huggingface_hub import hf_hub_download
        def cached_download(url, *args, **kwargs):
            # Simple wrapper - asteroid uses this for model downloads
            return hf_hub_download(*args, **kwargs)
        huggingface_hub.cached_download = cached_download
except ImportError:
    pass


class HumanVoiceSeparation:
    """
    Wrapper for MultiDecoderDPRNN model to separate human voices
    Uses the model from models/HumanModel folder
    """
    
    def __init__(self):
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # Path to the HumanModel folder
        self.model_base_path = Path(__file__).parent.parent / "models" / "HumanModel"
        
    def load_model(self):
        """Load the MultiDecoderDPRNN model"""
        if self.model is not None:
            return  # Already loaded
        
        try:
            # Import the model architecture from the asteroid folder
            model_file = self.model_base_path / "asteroid" / "egs" / "wsj0-mix-var" / "Multi-Decoder-DPRNN" / "model.py"
            
            if not model_file.exists():
                raise FileNotFoundError(f"Model file not found at {model_file}")
            
            spec = importlib.util.spec_from_file_location("local_model", str(model_file))
            local_model = importlib.util.module_from_spec(spec)
            sys.modules["local_model"] = local_model
            spec.loader.exec_module(local_model)
            
            MultiDecoderDPRNN = local_model.MultiDecoderDPRNN
            
            # Load pretrained model (requires internet for first download)
            try:
                from pytorch_lightning.callbacks import ModelCheckpoint, EarlyStopping
                with torch.serialization.safe_globals([ModelCheckpoint, EarlyStopping]):
                    self.model = MultiDecoderDPRNN.from_pretrained(
                        "JunzheJosephZhu/MultiDecoderDPRNN"
                    ).eval()
            except:
                # Fallback: load without safe_globals if not available
                self.model = MultiDecoderDPRNN.from_pretrained(
                    "JunzheJosephZhu/MultiDecoderDPRNN"
                ).eval()
            
            if self.device == "cuda":
                self.model.cuda()
                
            print(f"✓ Human voice separation model loaded on {self.device}")
            
        except Exception as e:
            raise RuntimeError(f"Failed to load human separation model: {str(e)}")
    
    def estimate_sources(self, wave, min_src=2, max_src=5):
        """
        Estimate the number of speakers based on audio energy
        
        Args:
            wave: Audio tensor [channels, samples]
            min_src: Minimum number of sources
            max_src: Maximum number of sources
            
        Returns:
            Estimated number of sources
        """
        wave_np = wave.cpu().numpy()
        energy_per_channel = np.sum(wave_np**2, axis=1)
        avg_energy = np.mean(energy_per_channel)

        if avg_energy < 0.5:
            return min_src
        elif avg_energy < 1.5:
            return 3
        else:
            return max_src
    
    def separate(self, input_file, output_dir, min_src=2, max_src=4):
        """
        Separate human voices from mixed audio
        
        Args:
            input_file: Path to input audio file
            output_dir: Directory to save separated sources
            min_src: Minimum number of sources to separate
            max_src: Maximum number of sources to separate
            
        Returns:
            Dictionary with source names and file paths
        """
        # Ensure model is loaded
        self.load_model()
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Read audio file
        mixture_wave, sr = sf.read(input_file)
        mixture_wave = torch.tensor(mixture_wave, dtype=torch.float32)
        
        # Convert to [channels, samples] format
        if mixture_wave.ndim == 1:
            mixture_wave = mixture_wave.unsqueeze(0)
        else:
            mixture_wave = mixture_wave.T
        
        # Move to device
        if self.device == "cuda":
            mixture_wave = mixture_wave.cuda()
        
        # Estimate number of sources
        n_src = self.estimate_sources(mixture_wave, min_src, max_src)
        print(f"Estimated {n_src} speakers in the audio")
        
        # Separate sources
        with torch.no_grad():
            sources_est = self.model.separate(mixture_wave, n_src=n_src).cpu()
        
        # Save separated sources
        file_base = Path(input_file).stem
        separated_files = {}
        
        for i, source in enumerate(sources_est):
            source_name = f"speaker_{i+1}"
            source_filename = os.path.join(output_dir, f"{file_base}_{source_name}.wav")
            sf.write(source_filename, source.numpy().T, sr)
            separated_files[source_name] = source_filename
            print(f"Saved {source_name}: {source_filename}")
        
        return separated_files
    
    def is_installed(self):
        """Check if the model and dependencies are available"""
        try:
            # Check if model file exists
            model_file = self.model_base_path / "asteroid" / "egs" / "wsj0-mix-var" / "Multi-Decoder-DPRNN" / "model.py"
            if not model_file.exists():
                return False
            
            # Check basic dependencies
            import torch
            import soundfile
            import numpy
            
            return True
        except ImportError:
            return False


# Convenience function
def separate_human_voices(input_file, output_dir, min_src=2, max_src=4):
    """
    Separate human voices from audio file
    
    Args:
        input_file: Path to input audio file
        output_dir: Directory to save separated sources
        min_src: Minimum number of sources
        max_src: Maximum number of sources
        
        Returns:
        Dictionary with source names and file paths
    """
    separator = HumanVoiceSeparation()
    return separator.separate(input_file, output_dir, min_src, max_src)
