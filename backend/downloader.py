import yt_dlp
import os

class YouTubeDownloader:
    def __init__(self, ffmpeg_path=None):
        self.ffmpeg_path = ffmpeg_path
        self.is_cancelled = False

    def download_audio(self, url, output_dir, format_type, quality, progress_callback=None):
        """Download audio using yt-dlp API"""
        try:
            quality_param = {
                "high": "0" if format_type == "wav" else "320k",
                "medium": "1" if format_type == "wav" else "192k",
                "low": "2" if format_type == "wav" else "128k"
            }[quality]

            ydl_opts = {
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': format_type,
                    'preferredquality': quality_param,
                }],
                'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
                'progress_hooks': [lambda d: self._progress_hook(d, progress_callback)],
                'noplaylist': True,
                'quiet': True,
                'no_warnings': True,
            }

            if self.ffmpeg_path:
                ydl_opts['ffmpeg_location'] = os.path.dirname(self.ffmpeg_path)

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get('title', 'Unknown Title')
                filename = ydl.prepare_filename(info)
                final_filename = f"{os.path.splitext(filename)[0]}.{format_type}"

                return {
                    'success': True,
                    'title': title,
                    'filename': os.path.basename(final_filename),
                    'path': final_filename
                }
            

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def cancel_download(self):
        """Set flag to cancel download and clean up partial downloads"""
        self.is_cancelled = True
        
        # Clean up .part files if we have filename information
        if hasattr(self, 'current_filename') and self.current_filename:
            base_name = os.path.basename(os.path.splitext(self.current_filename)[0])
            dir_path = os.path.dirname(self.current_filename)
            
            # Find and delete all .part files containing the base filename
            for file in os.listdir(dir_path):
                if file.endswith('.part') and base_name in file:
                    try:
                        os.remove(os.path.join(dir_path, file))
                        print(f"Removed partial download file: {file}")
                    except Exception as e:
                        print(f"Failed to delete {file}: {e}")
        
        return True

    def validate_url(self, url):
        """Validate YouTube URL and get video information"""
        try:
            if not url:
                return {'success': False, 'error': 'Please enter a YouTube URL'}

            ydl_opts = {
                'format': 'bestaudio/best',
                'noplaylist': True,
                'quiet': True,
                'no_warnings': True,
                'simulate': True,
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return {
                    'success': True,
                    'title': info.get('title', 'Unknown Title'),
                    'duration': info.get('duration'),
                    'uploader': info.get('uploader')
                }

        except Exception as e:
            return {
                'success': False,
                'error': f"Invalid YouTube URL: {str(e)}"
            }

    def _progress_hook(self, d, progress_callback):
        # Store current filename when available
        if 'filename' in d:
            self.current_filename = d['filename']
        
        # Check cancellation and raise a specific exception recognized by yt-dlp
        if self.is_cancelled:
            # Using the same exception type that yt-dlp uses for cancellations
            raise yt_dlp.utils.DownloadError("Download cancelled by user")
        
        if not progress_callback:
            return

        if d['status'] == 'downloading':
            if 'total_bytes' in d and d['total_bytes'] > 0:
                percent = d['downloaded_bytes'] / d['total_bytes'] * 100
            elif 'total_bytes_estimate' in d and d['total_bytes_estimate'] > 0:
                percent = d['downloaded_bytes'] / d['total_bytes_estimate'] * 100
            else:
                percent = 0
            
            progress_callback({
                'status': 'downloading',
                'percent': percent,
                'speed': d.get('speed'),
                'eta': d.get('eta')
            })
        
        elif d['status'] == 'finished':
            progress_callback({
                'status': 'converting',
                'percent': 95
            })
