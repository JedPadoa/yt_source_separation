import os
import json
import platform

class Settings:
    def __init__(self):
        self.settings_dir = os.path.join(os.path.expanduser("~"), '.ytaudiodownloader')
        self.settings_file = os.path.join(self.settings_dir, 'settings.json')
        os.makedirs(self.settings_dir, exist_ok=True)

    def get_default_downloads_folder(self):
        """Get default downloads folder"""
        return os.path.join(os.path.expanduser("~"), "Downloads")

    def load_settings(self):
        """Load settings from JSON file"""
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading settings: {e}")
        
        return {'download_path': self.get_default_downloads_folder()}

    def save_settings(self, settings):
        """Save settings to JSON file"""
        try:
            with open(self.settings_file, 'w') as f:
                json.dump(settings, f)
            return True
        except Exception as e:
            print(f"Error saving settings: {e}")
            return False
