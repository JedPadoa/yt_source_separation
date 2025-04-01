#!/usr/bin/env python3
import os
import sys
import json
import shutil
import platform
import tkinter as tk
from tkinter import filedialog
import yt_dlp
import demucs.separate
import signal
import atexit
import multiprocessing
import traceback

# Global variables
ffmpeg_path = None
termination_requested = False

def setup_environment():
    """Setup environment variables and paths"""
    global ffmpeg_path
    
    # Handle bundled app resources
    if getattr(sys, 'frozen', False):
        # Running as bundled app
        bundle_dir = os.path.dirname(sys.executable)
        
        # Check for bundled FFmpeg
        if platform.system() == "Windows":
            bundled_ffmpeg = os.path.join(bundle_dir, "ffmpeg.exe")
        elif platform.system() == "Darwin":  # macOS
            bundled_ffmpeg = os.path.join(bundle_dir, "ffmpeg")
        else:  # Linux
            bundled_ffmpeg = os.path.join(bundle_dir, "ffmpeg")
            
        if os.path.exists(bundled_ffmpeg):
            ffmpeg_path = bundled_ffmpeg
            # Add to environment for subprocesses
            os.environ["PATH"] = os.pathsep.join([bundle_dir, os.environ.get("PATH", "")])
            print(f"Using bundled FFmpeg at: {ffmpeg_path}")

def signal_handler(signum, frame):
    """Handle termination signals by setting a flag"""
    global termination_requested
    print(f"Received signal {signum}, cleaning up...", file=sys.stderr)
    termination_requested = True
    # Clean exit to allow resource tracker to clean up properly
    sys.exit(0)

def cleanup_resources():
    """Clean up any resources on exit"""
    # This helps ensure multiprocessing resources are released
    if hasattr(multiprocessing, 'resource_tracker'):
        try:
            # Force the resource tracker to clean up any remaining resources
            multiprocessing.resource_tracker._resource_tracker.clear()
        except:
            pass

def get_default_downloads_folder():
    """Get the default downloads folder based on the OS"""
    if platform.system() == "Windows":
        return os.path.join(os.path.expanduser("~"), "Downloads")
    elif platform.system() == "Darwin":  # macOS
        return os.path.join(os.path.expanduser("~"), "Downloads")
    else:  # Linux and others
        return os.path.join(os.path.expanduser("~"), "Downloads")

def check_ffmpeg():
    """Check if FFmpeg is installed and available"""
    global ffmpeg_path
    
    # First check if we already found FFmpeg in the bundled app
    if ffmpeg_path and os.path.exists(ffmpeg_path):
        return True
        
    # Next, try PATH
    ffmpeg_path = shutil.which("ffmpeg")
    
    # If not in PATH, check common Homebrew locations on macOS
    if not ffmpeg_path and platform.system() == "Darwin":
        homebrew_paths = [
            "/usr/local/bin/ffmpeg",  # Intel Macs
            "/opt/homebrew/bin/ffmpeg"  # Apple Silicon
        ]
        
        for path in homebrew_paths:
            if os.path.exists(path) and os.access(path, os.X_OK):
                ffmpeg_path = path
                print(f"Found FFmpeg in Homebrew location: {ffmpeg_path}")
                return True
    
    if not ffmpeg_path:
        print("FFmpeg was not found on your system. Audio conversion may not work correctly.")
        return False
    
    return True

def progress_hook(d, progress_callback=None):
    """Progress hook for yt-dlp"""
    if d['status'] == 'downloading':
        # Update progress
        if 'total_bytes' in d and d['total_bytes'] > 0:
            percent = d['downloaded_bytes'] / d['total_bytes'] * 100
            if progress_callback:
                progress_callback(percent, 'downloading', d.get('speed'), d.get('eta'))
        elif 'total_bytes_estimate' in d and d['total_bytes_estimate'] > 0:
            percent = d['downloaded_bytes'] / d['total_bytes_estimate'] * 100
            if progress_callback:
                progress_callback(percent, 'downloading', d.get('speed'), d.get('eta'))
    
    elif d['status'] == 'finished':
        if progress_callback:
            progress_callback(95, 'converting')

def download_audio(url, output_dir, format_type, quality, progress_callback=None):
    """Download audio using yt-dlp API directly"""
    try: 
        # Set quality parameters based on selection
        if quality == "high":
            quality_param = "0" if format_type == "wav" else "320k"
        elif quality == "medium":
            quality_param = "1" if format_type == "wav" else "192k"
        else:  # low
            quality_param = "2" if format_type == "wav" else "128k"
        
        # Configure yt-dlp options based on format
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': format_type,
                'preferredquality': quality_param,
            }],
            'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
            'progress_hooks': [lambda d: progress_hook(d, progress_callback)],
            'noplaylist': True,
            'quiet': True,  # Don't print debug output
            'no_warnings': True,  # Suppress warnings
        }
        
        # Add FFmpeg location if available
        if ffmpeg_path and os.path.exists(ffmpeg_path):
            ydl_opts['ffmpeg_location'] = os.path.dirname(ffmpeg_path)
            print(f"Using FFmpeg from: {os.path.dirname(ffmpeg_path)}")
        
        # Download the audio
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            # Get the title of the downloaded video
            title = info.get('title', 'Unknown Title')
            filename = ydl.prepare_filename(info)
            # Replace the extension with the correct one
            base_filename = os.path.splitext(filename)[0]
            final_filename = f"{base_filename}.{format_type}"
            
            return {
                'success': True,
                'title': title,
                'filename': os.path.basename(final_filename),
                'path': final_filename
            }
    
    except Exception as e:
        error_message = f"An error occurred: {str(e)}"
        print(error_message)
        return {
            'success': False,
            'error': error_message
        }

def validate_url(url):
    """Validate a YouTube URL and get video information"""
    try:
        if not url:
            return {'success': False, 'error': 'Please enter a YouTube URL'}
        
        # Use yt-dlp to validate and get info
        ydl_opts = {
            'format': 'bestaudio/best',
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
            'simulate': True,  # Don't download, just validate
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
        error_message = f"Invalid YouTube URL: {str(e)}"
        print(error_message)
        return {
            'success': False,
            'error': error_message
        }

def load_settings():
    """Load settings from JSON file"""
    settings_file = os.path.join(os.path.expanduser("~"), '.ytaudiodownloader', 'settings.json')
    
    if os.path.exists(settings_file):
        try:
            with open(settings_file, 'r') as f:
                settings = json.load(f)
                
            # Load FFmpeg path if available
            global ffmpeg_path
            if 'ffmpeg_path' in settings and os.path.exists(settings['ffmpeg_path']):
                ffmpeg_path = settings['ffmpeg_path']
                
            # Return download path settings
            if 'download_path' in settings and os.path.isdir(settings['download_path']):
                return settings['download_path']
        except Exception as e:
            print(f"Error loading settings: {e}")
    
    return get_default_downloads_folder()

def save_settings(download_path):
    """Save settings to a JSON file"""
    settings = {
        'download_path': download_path
    }
    
    # Save FFmpeg path if available and not in a bundled app
    if ffmpeg_path and not getattr(sys, 'frozen', False):
        settings['ffmpeg_path'] = ffmpeg_path

    # Create settings directory if it doesn't exist
    settings_dir = os.path.join(os.path.expanduser("~"), '.ytaudiodownloader')
    os.makedirs(settings_dir, exist_ok=True)
    
    # Save settings
    settings_file = os.path.join(settings_dir, 'settings.json')
    with open(settings_file, 'w') as f:
        json.dump(settings, f)

def select_directory(initial_dir=None):
    """Open a native file dialog to select a directory"""
    try:
        if platform.system() == "Darwin":  # macOS specific approach
            try:
                from AppKit import NSOpenPanel, NSApplication
                from Foundation import NSURL, NSString
                import objc
                
                # Get the shared application instance
                app = NSApplication.sharedApplication()
                
                # Create an NSOpenPanel instance
                panel = NSOpenPanel.openPanel()
                panel.setCanChooseDirectories_(True)
                panel.setCanChooseFiles_(False)
                panel.setAllowsMultipleSelection_(False)
                panel.setTitle_("Select Directory")
                
                # Prevent showing a dock icon for the panel
                panel.setLevel_(1000)  # NSFloatingWindowLevel to keep it above other windows
                
                if initial_dir is None:
                    initial_dir = load_settings()
                
                # Set the initial directory
                if initial_dir and os.path.exists(initial_dir):
                    url = NSURL.fileURLWithPath_(initial_dir)
                    panel.setDirectoryURL_(url)
                
                # Keep it in front
                panel.setCanBecomeKey_(True)
                panel.makeKeyAndOrderFront_(None)
                panel.becomeFirstResponder()
                
                # Run the panel as a modal dialog
                result = panel.runModal()
                
                # NSModalResponseOK = 1
                if result == 1:
                    urls = panel.URLs()
                    if urls and urls.count() > 0:
                        path = urls.objectAtIndex_(0).path()
                        return {
                            'success': True,
                            'directory': path
                        }
                
                # User canceled
                return {
                    'success': False,
                    'error': 'No directory selected'
                }
                
            except Exception as e:
                # Log the exception for debugging
                print(f"Error with NSOpenPanel: {str(e)}")
                # Fallback if AppKit is not available or has errors
                print("AppKit error, falling back to tkinter")
        
        # Standard approach using tkinter for non-macOS or fallback
        if not initial_dir:
            initial_dir = load_settings()
        
        # Create a tkinter root window that's invisible
        root = tk.Tk()
        root.withdraw()
        
        # Make the window appear on top
        root.attributes('-topmost', True)
        
        # On macOS, prevent dock icon (though this is better handled with AppKit)
        if platform.system() == "Darwin":
            try:
                # These commands help but aren't as effective as AppKit
                root.createcommand('::tk::mac::RealizeWindowDelayed', root.update)
                root.createcommand('::tk::mac::OnActivateApp', lambda: root.focus_force())
            except:
                pass
        
        # Open the directory dialog
        directory = filedialog.askdirectory(
            title="Select Directory",
            initialdir=initial_dir,
            parent=root
        )
        
        # Clean up
        root.destroy()
        
        if directory:
            return {
                'success': True,
                'directory': directory
            }
        else:
            return {
                'success': False,
                'error': 'No directory selected'
            }
            
    except Exception as e:
        error_message = f"Error opening directory dialog: {str(e)}"
        print(error_message)
        return {
            'success': False,
            'error': error_message
        }

def get_settings():
    """Get the current settings"""
    download_path = load_settings()
    return {
        'download_path': download_path
    }

def separate_audio(audio_path, file_type, output_path):
    """Separate audio into vocals and accompaniment using demucs"""
    print(f"Starting separation for: {audio_path}")
    print(f"Output path: {output_path}")
    
    try:
        # Call demucs with the arguments
        demucs.separate.main([f"--{file_type}", "--two-stems", "vocals",
                            audio_path, f"-o{output_path}"])
        print(f"Separation complete")
        _alter_folder_structure(audio_path, output_path)
    except Exception as e:
        print(f"Error during separation: {str(e)}", file=sys.stderr)
        raise

def _alter_folder_structure(audio_path, output_path):
    """Reorganize the output folder structure after separation"""
    base_filename = os.path.basename(audio_path)
    base_name = os.path.splitext(base_filename)[0]

    model_folder = os.path.join(output_path, "htdemucs")
    new_folder = os.path.join(output_path, "separated audio")
    
    try:
        # Check if model folder exists and rename it
        if os.path.exists(model_folder):
            # If "separated audio" folder already exists, move contents instead
            if os.path.exists(new_folder):
                # For each file in the model folder, move it to the new folder
                for item in os.listdir(model_folder):
                    if item.startswith(base_name):
                        source = os.path.join(model_folder, item)
                        destination = os.path.join(new_folder, item)
                        shutil.move(source, destination)
                # Remove the now empty model folder
                if len(os.listdir(model_folder)) == 0:
                    os.rmdir(model_folder)
            else:
                # Just rename the folder
                os.rename(model_folder, new_folder)
                
        print(f"Files saved to {new_folder}")
    except Exception as e:
        print(f"Error organizing output files: {str(e)}", file=sys.stderr)
        sys.exit(1)

def main():
    """Main entry point for command line interface"""
    # Log directory for debug logs
    log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, 'debug_log.txt')
    
    # Log arguments received
    with open(log_file, 'a') as f:
        f.write(f"Args received: {sys.argv}\n")
    
    if len(sys.argv) < 2:
        result = {'success': False, 'error': 'No function specified'}
        print(json.dumps(result))
        sys.exit(1)
        
    function_name = sys.argv[1]
    
    try:
        # Call the appropriate function based on the first argument
        if function_name == 'validate_url':
            if len(sys.argv) < 3:
                result = {'success': False, 'error': 'No URL provided'}
            else:
                url = sys.argv[2]
                with open(log_file, 'a') as f:
                    f.write(f"Validating URL: {url}\n")
                result = validate_url(url)
                with open(log_file, 'a') as f:
                    f.write(f"Validation result: {result}\n")
            
        elif function_name == 'get_settings':
            result = get_settings()
            
        elif function_name == 'save_settings':
            if len(sys.argv) < 3:
                result = {'success': False, 'error': 'No download path provided'}
            else:
                download_path = sys.argv[2]
                save_settings(download_path)
                result = {'success': True}
            
        elif function_name == 'select_directory':
            result = select_directory()
            
        elif function_name == 'download_audio':
            if len(sys.argv) < 6:
                result = {'success': False, 'error': 'Missing parameters for download_audio'}
            else:
                url = sys.argv[2]
                output_dir = sys.argv[3]
                format_type = sys.argv[4]
                quality = sys.argv[5]
                
                # Define a progress callback that prints progress as JSON
                def progress_callback(percent, status, speed=None, eta=None):
                    progress_data = {
                        'percent': percent,
                        'status': status
                    }
                    if speed is not None:
                        progress_data['speed'] = speed
                    if eta is not None:
                        progress_data['eta'] = eta
                    
                    # Print progress updates to stderr to avoid interfering with the final JSON result
                    sys.stderr.write(f"PROGRESS: {json.dumps(progress_data)}\n")
                    sys.stderr.flush()
                
                result = download_audio(url, output_dir, format_type, quality, progress_callback)
                
        elif function_name == 'separate_audio':
            if len(sys.argv) < 5:
                result = {'success': False, 'error': 'Missing parameters for separate_audio'}
            else:
                audio_path = sys.argv[2]
                file_type = sys.argv[3]
                output_path = sys.argv[4]
                try:
                    separate_audio(audio_path, file_type, output_path)
                    result = {'success': True}
                except Exception as e:
                    result = {'success': False, 'error': str(e)}
                
        else:
            result = {'success': False, 'error': f'Unknown function: {function_name}'}
        
        # Print the result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        # Log the exception
        with open(log_file, 'a') as f:
            f.write(f"Exception: {str(e)}\n")
            f.write(traceback.format_exc())
        
        # Print error as JSON
        print(json.dumps({
            'success': False,
            'error': f"Error: {str(e)}"
        }))
        sys.exit(1)

# Initialize the module when imported
setup_environment()
check_ffmpeg()

# Register signal handlers and cleanup
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)
atexit.register(cleanup_resources)

if __name__ == '__main__':
    main()