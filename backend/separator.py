import torch
from pathlib import Path
import demucs.api
import sys
import os
import multiprocessing
import signal
import atexit
import math
import json

class LocalDemucsSeparator:
    def __init__(self):
        if getattr(sys, 'frozen', False):  # PyInstaller creates a temp folder and stores path in _MEIPASS
            base_dir = Path(sys._MEIPASS)
        else:
            base_dir = Path(__file__).parent.parent
            # Adjust depending on your folder structure
        model_dir = Path(f'{base_dir}/model/hub/checkpoints')
        torch.hub.set_dir(model_dir)
        self.separator = demucs.api.Separator(repo=model_dir, model='955717e8', callback=self.callback)
        self.separation_process = None
        self.is_cancelled = False
        self.progress_callback = None
        # Register cleanup on exit
        atexit.register(self._cleanup)
        
    def callback(self, progress_dict):
        progress_percent = math.floor(progress_dict['segment_offset'] / progress_dict['audio_length'] * 100)
        
        progress_data = {
            'type': 'separation',
            'percent': progress_percent,
            'state': progress_dict.get('state', ''),
            'model_idx': progress_dict.get('model_idx_in_bag', 0),
            'total_models': progress_dict.get('models', 1)
        }
        
        if hasattr(self, 'window'):
            # Convert None values to null and ensure proper JSON serialization
            serialized_data = json.dumps(progress_data)
            event_name = 'separation-progress'
            print(f"API progress handler received progress data: {self.progress_callback}")
            js = f"window.dispatchEvent(new CustomEvent('{event_name}', {{detail: {self.progress_callback}}}))"
            self.window.evaluate_js(js)
            
        print(f'progress: {progress_percent}%')
        return progress_percent
    
    def set_progress_callback(self, callback):
        """Set a callback function for progress updates"""
        self.progress_callback = self.callback
        print(f'progress callback set: {self.progress_callback}')
        
    def _cleanup(self):
        """Clean up any running processes and resources"""
        if self.separation_process:
            try:
                self.separation_process.terminate()
                self.separation_process.join()
            except:
                pass
            finally:
                self.separation_process = None

    def separate_audio(self, audio_path, output_path):
        # Clean up any existing process first
        self._cleanup()
        
        # Create and start new process
        self.is_cancelled = False
        self.separation_process = multiprocessing.Process(
            target=self._run_separation,
            args=(audio_path, output_path)
        )
        self.separation_process.start()
        # Wait for process to complete
        self.separation_process.join()
        
        # Clean up after completion
        result = self.separation_process.exitcode == 0
        self._cleanup()
        
        return {
            'success': result,
            'stemsPath': f"{output_path}/separated_audio/{Path(audio_path).stem}" if result else None
        }

    def cancel_separation(self):
        """Cancel ongoing separation and clean up"""
        if not self.separation_process:
            return {'success': False, 'error': 'No active separation process'}
            
        try:
            self.is_cancelled = True
            self.separation_process.terminate()
            self.separation_process.join()
            self._cleanup()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
        
    def _run_separation(self, audio_path, output_path):
        try:
            origin, separated = self.separator.separate_audio_file(audio_path)
            self._save_audio(separated, output_path, Path(audio_path).stem)
        except Exception as e:
            print(f"Error: {e}")
        
    def _save_audio(self, separated, output_path, name):
        try:
            os.makedirs(f'{output_path}/separated_audio/{name}', exist_ok=True)
            for stem, source in separated.items():
                output_name= f"{stem}.wav"
                output = f'{output_path}/separated_audio/{name}/{output_name}'
                demucs.api.save_audio(source, output, samplerate=self.separator.samplerate)
                print(f"Saved {output_name}")
        except Exception as e:
            print(f"Error: {e}")
            
if __name__ == "__main__":
    audio_path = '/Users/jeddo/Downloads/DBK_TR10_78_vocals_choir_low_loop_blurred_vision_Dmin.wav'
    output_path = '/Users/jeddo/Downloads'
    separator = LocalDemucsSeparator()
    separator.separate_audio(audio_path, output_path)
        
        
        
        
