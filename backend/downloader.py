import yt_dlp
import os

class YouTubeDownloader:
    def __init__(self, ffmpeg_path=None):
        self.ffmpeg_path = ffmpeg_path

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
