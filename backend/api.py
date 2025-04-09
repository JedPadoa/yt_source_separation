import os
from .downloader import YouTubeDownloader
from .settings import Settings
import json
import static_ffmpeg
import urllib.request
import torch
import sys
import atexit
from pathlib import Path
import demucs.api
import multiprocessing
import math

class API:
    """Main API class exposed to JavaScript"""
    
    def __init__(self):
        self.settings = Settings()
        self.downloader = YouTubeDownloader()
        self.progress_callback = None
        #demucs variables
        if getattr(sys, 'frozen', False):  # PyInstaller creates a temp folder and stores path in _MEIPASS
            base_dir = Path(sys._MEIPASS)
        else:
            base_dir = Path(__file__).parent.parent
            # Adjust depending on your folder structure
        model_dir = Path(f'{base_dir}/model/hub/checkpoints')
        torch.hub.set_dir(model_dir)
        
        self.separator = demucs.api.Separator(repo=model_dir, model='955717e8', callback=self.callback)
        self.cancellation_requested = False
       
        self._load_settings()

    def _load_settings(self):
        """Load initial settings"""
        settings = self.settings.load_settings()
        if 'ffmpeg_path' in settings:
            self.downloader.ffmpeg_path = settings['ffmpeg_path']
    
    def download_ffmpeg(self):
        """Download ffmpeg"""
        try:
            static_ffmpeg.add_paths()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_settings(self):
        """Get current settings"""
        return self.settings.load_settings()

    def save_settings(self, download_path):
        """Save settings"""
        settings = {'download_path': download_path}
        if self.downloader.ffmpeg_path:
            settings['ffmpeg_path'] = self.downloader.ffmpeg_path
        return self.settings.save_settings(settings)

    def validate_url(self, url):
        """Validate YouTube URL"""
        return self.downloader.validate_url(url)

    def download_audio(self, options):
        """Download audio from YouTube"""
        if not isinstance(options, dict):
            return {'success': False, 'error': 'Options must be a dictionary'}
        
        required_keys = ['url', 'output_dir', 'format_type', 'quality']
        missing_keys = [key for key in required_keys if key not in options]
        
        if missing_keys:
            return {'success': False, 'error': f'Missing required options: {", ".join(missing_keys)}'}
        
        return self.downloader.download_audio(
            options['url'],
            options['output_dir'],
            options['format_type'],
            options['quality'],
            self._handle_progress
        )
    
    def cancel_download(self):
        """Cancel ongoing YouTube download"""
        try:
            # Set a flag in the downloader to cancel
            self.downloader.cancel_download()
            return {'success': True, 'message': 'Download cancellation requested'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _handle_progress(self, progress_data):
        """Handle progress updates"""
        print(f"API progress handler received progress data: {progress_data}")
        # This will be connected to the window's evaluate_js method
        # to send progress updates to the frontend
        if hasattr(self, 'window'):
            # Convert None values to null and ensure proper JSON serialization
            serialized_data = json.dumps(progress_data)
            event_name = 'separation-progress' if progress_data.get('type') == 'separation' else 'download-progress'
            js = f"window.dispatchEvent(new CustomEvent('{event_name}', {{detail: {serialized_data}}}))"
            self.window.evaluate_js(js)

    def browse_directory(self):
        """Open directory selection dialog"""
        import webview
        try:
            directory = webview.windows[0].create_file_dialog(
                webview.FOLDER_DIALOG,
                directory='',
                allow_multiple=False
            )
            if directory:
                # Return first item since we don't allow multiple selection
                selected_dir = directory[0]
                # Save the selected directory in settings
                self.save_settings(selected_dir)
                return {
                    'success': True,
                    'path': selected_dir
                }
            return {
                'success': False,
                'error': 'No directory selected'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def browse_audio_file(self):
        """Open file selection dialog for audio files"""
        import webview
        try:
            file_types = ('Audio Files (*.mp3;*.wav;*.m4a;*.aac)',)
            files = webview.windows[0].create_file_dialog(
                webview.OPEN_DIALOG,
                directory='',
                allow_multiple=False,
                file_types=file_types
            )
            if files:
                # Return first item since we don't allow multiple selection
                selected_file = files[0]
                return {
                    'success': True,
                    'path': selected_file
                }
            return {
                'success': False,
                'error': 'No file selected'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    def callback(self, progress_dict):
        if self.cancellation_requested:
            raise Exception("Separation cancelled by user")
        
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
            ui_percent = progress_data['percent']
            event_name = 'separation-progress'
            print(f"API progress handler received progress data: {progress_percent}")
            js = f"window.dispatchEvent(new CustomEvent('{event_name}', {{detail: {progress_percent}}}))"
            self.window.evaluate_js(js)
            
        print(f'progress: {progress_percent}%')
        return progress_percent

    def separate_audio(self, audio_path, output_path):
        try:
            origin, separated = self.separator.separate_audio_file(audio_path)
            self._save_audio(separated, output_path, Path(audio_path).stem)
            return {
            'success':  True,
            'stemsPath': f"{output_path}/separated_audio/{Path(audio_path).stem}"
        }
        except Exception as e:
            if "Separation cancelled by user" in str(e):
                return {
                    'success': False,
                    'error': 'Separation was cancelled',
                    'cancelled': True
                }
            else:
                print(f"Error: {e}")
                return {
                    'success': False,
                    'error': str(e)
                }

    def cancel_separation(self):
        """Cancel ongoing separation and clean up"""
        try:
        # Set the cancellation flag that will be checked in the callback
            self.cancellation_requested = True
            return {'success': True, 'message': 'Cancellation requested'}
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
            
    def reset_separation_cancellation(self):
        """Reset the separation cancellation flag"""
        try:
            self.cancellation_requested = False
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def reset_download_cancellation(self):
        """Reset the download cancellation flag"""
        try:
            # Reset download cancellation flag in the downloader
            self.downloader.is_cancelled = False
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    audio_path = '/Users/jeddo/Downloads/DBK_TR10_78_vocals_choir_low_loop_blurred_vision_Dmin.wav'
    output_path = '/Users/jeddo/Downloads'
    api = API()
    api.separate_audio(audio_path, output_path)
