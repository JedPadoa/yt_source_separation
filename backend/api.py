import os
from .downloader import YouTubeDownloader
from .separator import LocalDemucsSeparator
from .settings import Settings
import json
import static_ffmpeg
import urllib.request

class API:
    """Main API class exposed to JavaScript"""
    
    def __init__(self):
        self.settings = Settings()
        self.downloader = YouTubeDownloader()
        self.separator = LocalDemucsSeparator()
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

    def separate_audio(self, audio_path, output_path):
        """Separate audio into vocals and instrumental"""
        return self.separator.separate_audio(audio_path, output_path)

    def cancel_separation(self):
        """Cancel ongoing audio separation"""
        return self.separator.cancel_separation()

    def _handle_progress(self, progress_data):
        """Handle progress updates"""
        print(f"API progress handler received progress data: {progress_data}")
        # This will be connected to the window's evaluate_js method
        # to send progress updates to the frontend
        if hasattr(self, 'window'):
            # Convert None values to null and ensure proper JSON serialization
            serialized_data = json.dumps(progress_data)
            event_name = 'separation-progress' if progress_data.get('type') == 'separation' else 'download-progress'
            print(f"API progress handler received progress data: {self.separator.progress_callback}")
            js = f"window.dispatchEvent(new CustomEvent('{event_name}', {{detail: {self.separator.progress_callback}}}))"
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
            
if __name__ == '__main__':
    audio_path = '/Users/jeddo/Downloads/DBK_TR10_78_vocals_choir_low_loop_blurred_vision_Dmin.wav'
    output_path = '/Users/jeddo/Downloads'
    api = API()
    api.separate_audio(audio_path, output_path)
