import torch
import soundfile as sf
from pytorch_lightning.callbacks import ModelCheckpoint, EarlyStopping
import importlib.util
import sys
import os
import numpy as np
import sounddevice as sd

# -------------------------------
output_dir = "separated_sources"
os.makedirs(output_dir, exist_ok=True)

# -------------------------------
file_path = r"E:\OneDrive\المستندات\SBE\DSP\Signal-Equalizer\backend\MultiDecoderDPRNN\HumanModel\asteroid\egs\wsj0-mix-var\Multi-Decoder-DPRNN\model.py"
spec = importlib.util.spec_from_file_location("local_model", file_path)
local_model = importlib.util.module_from_spec(spec)
sys.modules["local_model"] = local_model
spec.loader.exec_module(local_model)

MultiDecoderDPRNN = local_model.MultiDecoderDPRNN

# -------------------------------
with torch.serialization.safe_globals([ModelCheckpoint, EarlyStopping]):
    model = MultiDecoderDPRNN.from_pretrained(
        "JunzheJosephZhu/MultiDecoderDPRNN"
    ).eval()

if torch.cuda.is_available():
    model.cuda()

# -------------------------------
input_file = "download.wav"
file_base = os.path.splitext(os.path.basename(input_file))[0]

# -------------------------------
mixture_wave, sr = sf.read(input_file)
mixture_wave = torch.tensor(mixture_wave, dtype=torch.float32)

if mixture_wave.ndim == 1:
    mixture_wave = mixture_wave.unsqueeze(0)  # [1, samples]
else:
    mixture_wave = mixture_wave.T  # [channels, samples]

if torch.cuda.is_available():
    mixture_wave = mixture_wave.cuda()

# -------------------------------
original_filename = os.path.join(output_dir, f"{file_base}_mixture_original.wav")
sf.write(original_filename, mixture_wave.cpu().numpy().T, sr)
print(f"Saved {original_filename}")

# -------------------------------
def estimate_sources(wave, min_src=2, max_src=5):
    wave_np = wave.cpu().numpy()
    energy_per_channel = np.sum(wave_np**2, axis=1)
    avg_energy = np.mean(energy_per_channel)

    if avg_energy < 0.5:
        return min_src
    elif avg_energy < 1.5:
        return 3
    else:
        return max_src

n_src = estimate_sources(mixture_wave)

# -------------------------------
sources_est = model.separate(mixture_wave, n_src=n_src).cpu()

for i, source in enumerate(sources_est):
    source_filename = os.path.join(output_dir, f"{file_base}_source_{i+1}.wav")
    sf.write(source_filename, source.numpy().T, sr)
    print(f"Saved {source_filename}")

print("\nAll files saved and played in folder:", output_dir)
