// API wrapper for pywebview
const api = {
    async validateUrl(url) {
        return await window.pywebview.api.validate_url(url);
    },

    async getSettings() {
        return await window.pywebview.api.get_settings();
    },

    async saveSettings(downloadPath) {
        return await window.pywebview.api.save_settings(downloadPath);
    },

    async downloadAudio(options) {
        return await window.pywebview.api.download_audio(options);
    },

    async separateAudio(audioPath, outputPath) {
        return await window.pywebview.api.separate_audio(
            audioPath, outputPath
        );
    },

    async cancelSeparation() {
        return await window.pywebview.api.cancel_separation();
    },

    async browseDirectory() {
        return await window.pywebview.api.browse_directory();
    },

    async browseAudioFile() {
        return await window.pywebview.api.browse_audio_file();
    },

    async downloadFfmpeg() {
        return await window.pywebview.api.download_ffmpeg();
    },

    async cancelDownload() {
        return await window.pywebview.api.cancel_download();
    },

    async resetSeparationCancellation() {
        return await window.pywebview.api.reset_separation_cancellation();
    },

    async resetDownloadCancellation() {
        return await window.pywebview.api.reset_download_cancellation();
    }
};

// Export API
window.api = api;
