const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // YouTube URL validation
    validateYouTubeUrl: (url) => ipcRenderer.invoke('validate-youtube-url', url),
    
    // Get app settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    
    // Download audio
    downloadAudio: (options) => ipcRenderer.invoke('download-audio', options),
    
    // Select download directory
    selectDownloadDirectory: () => ipcRenderer.invoke('select-directory'),
    
    // Select audio file for separation
    selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
    
    // Source separation
    separateAudio: (options) => ipcRenderer.invoke('separate-audio', options),
    
    // Cancel the separation process
    cancelSeparation: () => ipcRenderer.invoke('cancel-separation'),
    
    // Receive download progress updates
    onDownloadProgress: (callback) => {
      ipcRenderer.on('download-progress', (event, progress) => callback(progress));
    },
    
    // Receive source separation progress updates but strip out actual message content
    onSeparationProgress: (callback) => {
      ipcRenderer.on('separation-progress', (event, progress) => {
        callback(progress);
      });
    },
    
    // Handle separation cancellation event
    onSeparationCancelled: (callback) => {
      ipcRenderer.on('separation-cancelled', (event) => callback());
    }
  }
);