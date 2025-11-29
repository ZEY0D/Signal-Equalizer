"""
Demucs Integration Module
Provides audio source separation using Meta's Demucs model
"""

import os
import subprocess
from pathlib import Path
from typing import Dict, Optional


class DemucsIntegration:
    """
    Wrapper for Demucs audio source separation
    
    Demucs separates audio into 4 stems:
    - drums: All drum sounds
    - bass: Bass guitar and low frequencies
    - vocals: Singing voice
    - other: Piano, guitars, and other instruments
    """
    
    def __init__(self, model_name: str = "mdx_extra_q"):
        """
        Initialize Demucs integration
        
        Args:
            model_name: Demucs model to use (default: mdx_extra_q - highest quality)
                       Other options: htdemucs, htdemucs_ft, mdx, mdx_extra
        """
        self.model_name = model_name
    
    def separate(
        self, 
        audio_file: str, 
        output_folder: str = "separated",
        two_stems: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Separate audio file into instrument stems using Demucs
        
        Args:
            audio_file: Path to input audio file (WAV, MP3, FLAC, etc.)
            output_folder: Directory where separated tracks will be saved
            two_stems: Optional - specify one stem to isolate (e.g., 'vocals')
                      Will output only that stem + everything else
        
        Returns:
            dict: Paths to separated audio files
                  Keys: 'drums', 'bass', 'vocals', 'other'
        
        Example:
            >>> demucs = DemucsIntegration()
            >>> stems = demucs.separate("song.mp3", "outputs/stems")
            >>> print(stems['vocals'])  # Path to vocals track
        """
        # Validate input file exists
        if not os.path.exists(audio_file):
            raise FileNotFoundError(f"Audio file not found: {audio_file}")
        
        # Create output folder
        os.makedirs(output_folder, exist_ok=True)
        
        # Build demucs command
        # Use --mp3 format to avoid torchcodec issues with WAV saving
        cmd = [
            'demucs',
            '-n', self.model_name,
            '-o', output_folder,
            '--mp3',  # Output as MP3 instead of WAV to bypass torchcodec
            '--mp3-bitrate', '320',  # High quality MP3
            audio_file
        ]
        
        # Add two-stems option if specified
        if two_stems:
            cmd.extend(['--two-stems', two_stems])
        
        print(f"🎵 Running Demucs separation...")
        print(f"   Model: {self.model_name}")
        print(f"   Input: {audio_file}")
        print(f"   Output: {output_folder}")
        
        try:
            # Run demucs command
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            print("✓ Demucs separation completed successfully")
            print(f"   STDOUT: {result.stdout}")
            if result.stderr:
                print(f"   STDERR: {result.stderr}")
            
        except subprocess.CalledProcessError as e:
            error_msg = f"Return code: {e.returncode}\n"
            error_msg += f"STDOUT: {e.stdout}\n" if e.stdout else "STDOUT: (empty)\n"
            error_msg += f"STDERR: {e.stderr}\n" if e.stderr else "STDERR: (empty)\n"
            error_msg += f"Command: {' '.join(cmd)}"
            print(f"❌ Demucs failed:\n{error_msg}")
            raise RuntimeError(f"Demucs separation failed:\n{error_msg}")
        except FileNotFoundError as e:
            error_msg = f"Demucs command not found. Is demucs installed?\nCommand: {' '.join(cmd)}"
            print(f"❌ {error_msg}")
            raise RuntimeError(error_msg)
        
        # Locate the separated files
        filename = Path(audio_file).stem
        output_dir = os.path.join(output_folder, self.model_name, filename)
        
        # Debug: Print expected directory and check what actually exists
        print(f"🔍 Looking for output in: {output_dir}")
        parent_dir = os.path.join(output_folder, self.model_name)
        if os.path.exists(parent_dir):
            print(f"   Parent dir exists: {parent_dir}")
            print(f"   Contents: {os.listdir(parent_dir)}")
        else:
            print(f"   ❌ Parent dir doesn't exist: {parent_dir}")
            if os.path.exists(output_folder):
                print(f"   Output folder contents: {os.listdir(output_folder)}")
        
        # Check if output directory exists
        if not os.path.exists(output_dir):
            raise RuntimeError(f"Demucs output directory not found: {output_dir}")
        
        # Build paths to separated stems
        stems = {}
        for stem_name in ['drums', 'bass', 'vocals', 'other']:
            # Try both .mp3 and .wav extensions
            stem_path_mp3 = os.path.join(output_dir, f'{stem_name}.mp3')
            stem_path_wav = os.path.join(output_dir, f'{stem_name}.wav')
            
            if os.path.exists(stem_path_mp3):
                stems[stem_name] = stem_path_mp3
                print(f"   ✓ {stem_name}: {stem_path_mp3}")
            elif os.path.exists(stem_path_wav):
                stems[stem_name] = stem_path_wav
                print(f"   ✓ {stem_name}: {stem_path_wav}")
        
        if len(stems) == 0:
            raise RuntimeError("No stems were generated by Demucs")
        
        return stems
    
    def is_installed(self) -> bool:
        """
        Check if Demucs is installed and available
        
        Returns:
            bool: True if demucs command is available
        """
        try:
            subprocess.run(
                ['demucs', '--help'],
                capture_output=True,
                check=True
            )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False


# Helper function for easy import
def separate_audio(
    audio_file: str,
    output_folder: str = "separated",
    model: str = "mdx_extra_q"
) -> Dict[str, str]:
    """
    Quick helper to separate audio with Demucs
    
    Args:
        audio_file: Path to audio file
        output_folder: Where to save separated tracks
        model: Demucs model name
    
    Returns:
        dict: Paths to separated stems
    """
    demucs = DemucsIntegration(model_name=model)
    return demucs.separate(audio_file, output_folder)


if __name__ == "__main__":
    """Test demucs integration"""
    print("=" * 60)
    print("DEMUCS INTEGRATION TEST")
    print("=" * 60)
    
    demucs = DemucsIntegration()
    
    # Check if installed
    if demucs.is_installed():
        print("✓ Demucs is installed and ready")
    else:
        print("❌ Demucs is not installed")
        print("   Install with: python -m pip install demucs==3.0.6")
