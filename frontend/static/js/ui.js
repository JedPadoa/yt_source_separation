// UI Manager
const UI = {
    elements: {},
    state: {
        currentView: 'url-view',
        videoData: null,
        settings: null,
        lastDownloadedFile: null,
        isSeparationCancelled: false
    },
    
    init() {
        // Cache DOM elements
        this.cacheElements();
        // Set up event listeners
        this.setupEventListeners();
    },

    cacheElements() {
        // Loading View
        this.elements.loadingView = document.getElementById('loading-view');

        // URL View
        this.elements.youtubeUrl = document.getElementById('youtube-url');
        this.elements.nextBtn = document.getElementById('next-btn');
        this.elements.clearBtn = document.getElementById('clear-btn');
        this.elements.urlStatus = document.getElementById('url-status');
        
        // Options View
        this.elements.videoTitle = document.getElementById('video-title');
        this.elements.downloadPath = document.getElementById('download-path');
        this.elements.browseBtn = document.getElementById('browse-btn');
        this.elements.optionsBackBtn = document.getElementById('options-back-btn');
        this.elements.downloadBtn = document.getElementById('download-btn');
        this.elements.optionsStatus = document.getElementById('options-status');
        this.elements.result = document.getElementById('result');
        this.elements.titleDisplay = document.getElementById('title-display');
        this.elements.pathDisplay = document.getElementById('path-display');

        // Cache all views
        this.elements.views = {
            loading: document.getElementById('loading-view'),
            url: document.getElementById('url-view'),
            options: document.getElementById('options-view'),
            separation: document.getElementById('separation-view')
        };

        // Separation View
        this.elements.inputAudioPath = document.getElementById('input-audio-path');
        this.elements.browseAudioBtn = document.getElementById('browse-audio-btn');
        this.elements.separationOutputPath = document.getElementById('separation-output-path');
        this.elements.browseOutputBtn = document.getElementById('browse-output-btn');
        this.elements.separationBackBtn = document.getElementById('separation-back-btn');
        this.elements.separateStartBtn = document.getElementById('separate-start-btn');
        this.elements.separateCancelBtn = document.getElementById('separate-cancel-btn');
        this.elements.separationStatus = document.getElementById('separation-status');
        this.elements.separationResult = document.getElementById('separation-result');
        this.elements.vocalsPath = document.getElementById('vocals-path');
        this.elements.instrumentalPath = document.getElementById('instrumental-path');
        
        // New buttons
        this.elements.separateBtn = document.getElementById('separate-btn');
        this.elements.resultSeparateBtn = document.getElementById('result-separate-btn');
    },

    setupEventListeners() {
        // Listen for pywebview ready
        window.addEventListener('pywebviewready', () => {
            console.log('pywebview is ready');
            this.onPywebviewReady();
        });

        // Listen for download progress
        window.addEventListener('download-progress', (e) => {
            this.updateProgress(e.detail);
        });

        // Listen for separation progress
        window.addEventListener('separation-progress', (e) => {
            if (!this.state.isSeparationCancelled) {
                const percent = Math.round(e.detail * 100);
                console.log(e.detail)
                this.showStatus('separation', `Separation in progress... ${percent}%`, 'info');
            }
        });

        // Listen for settings loaded
        window.addEventListener('settings-loaded', (e) => {
            this.updateSettings(e.detail);
        });

        // URL View Events
        this.elements.youtubeUrl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.elements.nextBtn.click();
            }
        });

        this.elements.nextBtn.addEventListener('click', () => this.handleNextButton());
        this.elements.clearBtn.addEventListener('click', () => this.handleClearButton());

        // Options View Events
        this.elements.optionsBackBtn.addEventListener('click', () => this.navigateToView('url-view'));
        this.elements.browseBtn.addEventListener('click', () => this.handleBrowseButton());
        this.elements.downloadBtn.addEventListener('click', () => this.handleDownloadButton());

        // Separation View Events
        this.elements.separateBtn.addEventListener('click', () => this.navigateToView('separation-view'));
        this.elements.resultSeparateBtn.addEventListener('click', () => this.handleResultSeparateButton());
        this.elements.browseAudioBtn.addEventListener('click', () => this.handleBrowseAudioButton());
        this.elements.browseOutputBtn.addEventListener('click', () => this.handleBrowseOutputButton());
        this.elements.separationBackBtn.addEventListener('click', () => this.handleSeparationBackButton());
        this.elements.separateStartBtn.addEventListener('click', () => this.handleSeparateStartButton());
        this.elements.separateCancelBtn.addEventListener('click', () => this.handleSeparateCancelButton());
    },

    async handleNextButton() {
        const url = this.elements.youtubeUrl.value.trim();
        if (!url) {
            this.showStatus('url', 'Please enter a YouTube URL', 'error');
            return;
        }

        this.elements.nextBtn.disabled = true;
        this.showStatus('url', 'Validating URL...', 'info');

        try {
            const result = await window.api.validateUrl(url);
            if (result.success) {
                this.state.videoData = {
                    url: url,
                    title: result.title
                };
                this.elements.videoTitle.textContent = result.title;
                this.navigateToView('options-view');
            } else {
                this.showStatus('url', result.error || 'Invalid YouTube URL', 'error');
            }
        } catch (error) {
            this.showStatus('url', 'Error validating URL', 'error');
        } finally {
            this.elements.nextBtn.disabled = false;
        }
    },

    handleClearButton() {
        this.elements.youtubeUrl.value = '';
        this.hideStatus('url');
        this.elements.youtubeUrl.focus();
    },

    async handleBrowseButton() {
        try {
            const result = await window.api.browseDirectory();
            if (result.success) {
                this.elements.downloadPath.value = result.path;
                this.hideStatus('options');
            } else {
                this.showStatus('options', result.error || 'Failed to select directory', 'error');
            }
        } catch (error) {
            console.error('Browse error:', error);
            this.showStatus('options', 'Error selecting directory', 'error');
        }
    },

    async handleDownloadButton() {
        if (!this.state.videoData || !this.elements.downloadPath.value) {
            this.showStatus('options', 'Missing required information', 'error');
            return;
        }

        this.elements.downloadBtn.disabled = true;
        this.showStatus('options', 'Starting download...', 'info');

        const format = document.querySelector('input[name="format"]:checked').value;
        const quality = document.querySelector('input[name="quality"]:checked').value;

        try {
            const result = await window.api.downloadAudio({
                url: this.state.videoData.url,
                output_dir: this.elements.downloadPath.value,
                format_type: format,
                quality: quality
            });

            if (result.success) {
                this.showResult(result.title, result.path);
            } else {
                this.showStatus('options', result.error || 'Download failed', 'error');
            }
        } catch (error) {
            console.error('Download error:', error);
            this.showStatus('options', 'Error during download', 'error');
        } finally {
            this.elements.downloadBtn.disabled = false;
        }
    },

    navigateToView(viewId) {
        Object.values(this.elements.views).forEach(view => {
            view.classList.remove('active');
        });
        this.elements.views[viewId.replace('-view', '')].classList.add('active');
        this.state.currentView = viewId;
    },

    showStatus(view, message, type) {
        const element = this.elements[`${view}Status`];
        if (element) {
            element.textContent = message;
            element.className = `status ${type}`;
            element.classList.remove('hidden');
        }
    },

    hideStatus(view) {
        const element = this.elements[`${view}Status`];
        if (element) {
            element.classList.add('hidden');
        }
    },

    updateProgress(progress) {
        if (progress.status === 'downloading') {
            this.showStatus('options', 
                `Downloading... ${Math.round(progress.percent)}%${progress.speed ? ` (${progress.speed})` : ''}`, 
                'info'
            );
        } else if (progress.status === 'converting') {
            this.showStatus('options', 'Converting audio...', 'info');
        }
    },

    updateSeparationProgress(progress) {
       console.log(progress)
    },

    showResult(title, path) {
        this.hideStatus('options');
        this.elements.titleDisplay.textContent = `TITLE: ${title}`;
        this.elements.pathDisplay.textContent = `SAVED: ${path}`;
        this.elements.result.classList.remove('hidden');
        this.state.lastDownloadedFile = path;
    },

    updateSettings(settings) {
        this.state.settings = settings;
        if (settings.download_path) {
            this.elements.downloadPath.value = settings.download_path;
        }
    },

    async onPywebviewReady() {
        try {
            // Download FFmpeg first
            const ffmpegResult = await window.api.downloadFfmpeg();
            if (!ffmpegResult.success) {
                throw new Error(ffmpegResult.error || 'Failed to initialize FFmpeg');
            }

            // Then load settings
            await window.api.getSettings();
            
            // Switch to URL view
            this.navigateToView('url-view');
        } catch (error) {
            console.error('Initialization error:', error);
            // Show error in loading view
            const loadingText = document.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = 'Error initializing app: ' + error.message;
                loadingText.style.color = '#ff0000';
            }
        }
    },

    async handleResultSeparateButton() {
        this.elements.inputAudioPath.value = this.state.lastDownloadedFile || '';
        this.elements.separationOutputPath.value = this.elements.downloadPath.value || '';
        this.navigateToView('separation-view');
    },

    async handleBrowseAudioButton() {
        try {
            const result = await window.api.browseAudioFile();
            if (result.success) {
                this.elements.inputAudioPath.value = result.path;
                this.hideStatus('separation');
            } else {
                this.showStatus('separation', result.error || 'Failed to select audio file', 'error');
            }
        } catch (error) {
            console.error('Browse error:', error);
            this.showStatus('separation', 'Error selecting audio file', 'error');
        }
    },

    async handleBrowseOutputButton() {
        try {
            const result = await window.api.browseDirectory();
            if (result.success) {
                this.elements.separationOutputPath.value = result.path;
                this.hideStatus('separation');
            } else {
                this.showStatus('separation', result.error || 'Failed to select directory', 'error');
            }
        } catch (error) {
            console.error('Browse error:', error);
            this.showStatus('separation', 'Error selecting directory', 'error');
        }
    },

    handleSeparationBackButton() {
        const targetView = this.state.lastDownloadedFile ? 'options-view' : 'url-view';
        this.navigateToView(targetView);
    },

    async handleSeparateStartButton() {
        const inputPath = this.elements.inputAudioPath.value;
        const outputPath = this.elements.separationOutputPath.value;
        const fileType = document.querySelector('input[name="separation-format"]:checked').value;

        if (!inputPath || !outputPath) {
            this.showStatus('separation', 'Please select input file and output directory', 'error');
            return;
        }

        // Reset cancelled state when starting new separation
        this.state.isSeparationCancelled = false;

        this.elements.separateStartBtn.disabled = true;
        this.elements.separateCancelBtn.classList.remove('hidden');
        
        try {
            // Clear previous results
            this.elements.separationResult.classList.add('hidden');
            
            // Show single status message
            this.showStatus('separation', 'Separation in progress... This may take several minutes.', 'info');

            const result = await window.api.separateAudio(inputPath, outputPath);
            
            if (!this.state.isSeparationCancelled) {
                if (result.success) {
                    this.showStatus('separation', 'Separation completed successfully!', 'success');
                } else {
                    this.showStatus('separation', result.error || 'Separation failed', 'error');
                }
            }
        } catch (error) {
            if (!this.state.isSeparationCancelled) {
                console.error('Separation error:', error);
                this.showStatus('separation', 'Error during separation', 'error');
            }
        } finally {
            if (!this.state.isSeparationCancelled) {
                this.elements.separateStartBtn.disabled = false;
                this.elements.separateCancelBtn.classList.add('hidden');
            }
        }
    },

    async handleSeparateCancelButton() {
        try {
            // Set cancelled state
            this.state.isSeparationCancelled = true;
            
            this.showStatus('separation', 'Cancelling separation...', 'cancel');
            const result = await window.api.cancelSeparation();
            
            if (result.success) {
                this.showStatus('separation', 'Separation cancelled', 'cancel');
                this.elements.separateStartBtn.disabled = false;
                this.elements.separateCancelBtn.classList.add('hidden');
            } else {
                this.showStatus('separation', result.error || 'Failed to cancel separation', 'error');
            }
        } catch (error) {
            console.error('Cancel error:', error);
            this.showStatus('separation', 'Error cancelling separation', 'error');
        }
    },

    // archived method
    showSeparationResult(stemsPath) {
        this.hideStatus('separation');
        this.elements.vocalsPath.textContent = `Stems saved to ${stemsPath}`;
        this.elements.separationResult.classList.remove('hidden');
    },

    // ... other UI methods
};
