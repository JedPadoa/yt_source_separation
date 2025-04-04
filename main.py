import webview
import os
import sys
from backend.api import API

class Application:
    def __init__(self):
        self.api = API()
        self.window = None

    def create_window(self):
        """Create the main application window"""
        # Get the HTML file path
        html_path = os.path.join(os.path.dirname(__file__), 'frontend', 'index.html')
        
        # Create window with our API exposed
        self.window = webview.create_window(
            'YouTube Audio Downloader',
            html_path,
            js_api=self.api,
            width=800,
            height=600,
            min_size=(400, 300),
            background_color='#000000',
        )
        
        # Connect window to API for progress updates
        self.api.window = self.window
        
        # Set up window events
        self.window.events.loaded += self.on_loaded
        self.window.events.closing += self.on_closing
        self.window.events.shown += self.on_shown

    def on_loaded(self):
        """Called when DOM is ready"""
        # Initialize any required state
        settings = self.api.get_settings()
        self.window.evaluate_js(f"window.dispatchEvent(new CustomEvent('settings-loaded', {{detail: {settings}}}));")

    def on_closing(self):
        """Called when window is about to close"""
        # Cleanup any resources
        pass

    def on_shown(self):
        """Called after window is shown"""
        if sys.platform == 'darwin':  # macOS specific
            self.window.evaluate_js('''
                document.documentElement.classList.add('macos');
            ''')

def main():
    # Create application instance
    app = Application()
    
    # Create the window
    app.create_window()
    
    # Start the application - only enable debug mode when running from source
    debug_mode = getattr(sys, 'frozen', False) == False
    webview.start(debug=debug_mode)

if __name__ == '__main__':
    main()
