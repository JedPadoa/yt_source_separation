import torch
from pathlib import Path
import demucs.api
import sys
class LocalDemucsSeparator:
    def __init__(self):
        if getattr(sys, 'frozen', False):  # PyInstaller creates a temp folder and stores path in _MEIPASS
            base_dir = Path(sys._MEIPASS)
        else:
            base_dir = Path(__file__).parent.parent
            # Adjust depending on your folder structure
        model_dir = Path(f'{base_dir}/model/hub/checkpoints')
        torch.hub.set_dir(model_dir)
        self.separator = demucs.api.Separator(repo=model_dir, model='955717e8')
        
    def separate_audio(self, audio_path, output_path):
        try:
            origin, separated = self.separator.separate_audio_file(audio_path)
            self._save_audio(separated, output_path)
            return {
            'success': True,
            'vocals_path': f"{output_path}/vocals.wav",
            }
        except Exception as e:
            print(f"Error: {e}")
            return {
            'success': False,
            'error': str(e)
            }
        
    def _save_audio(self, separated, output_path):
        try:
            for stem, source in separated.items():
                output_name= f"{stem}.wav"
                demucs.api.save_audio(source, f'{output_path}/{output_name}', samplerate=self.separator.samplerate)
                print(f"Saved {output_path}")
        except Exception as e:
            print(f"Error: {e}")
            
if __name__ == "__main__":
    audio_path = '/Users/jeddo/Downloads/DBK_TR10_78_vocals_choir_low_loop_blurred_vision_Dmin.wav'
    output_path = '/Users/jeddo/Downloads'
    separator = LocalDemucsSeparator()
    separator.separate_audio(audio_path, output_path)
        
        
        
        
