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

    defaultStates: {
        url: {
            inputValue: '',
            statusHidden: true
        },
        options: {
            videoTitle: '',
            statusHidden: true,
            resultHidden: true,
            downloadButtonDisabled: false
        },
        separation: {
            inputAudioPath: '',
            outputPath: '',
            statusHidden: true,
            resultHidden: true,
            startButtonDisabled: false,
            cancelButtonHidden: true,
            isCancelled: false
        }
    },

    init() {
        // Cache DOM elements
        this.cacheElements();
        // Set up event listeners
        this.setupEventListeners();
    },

    cacheElements() {
        // Define elements to cache by ID
        const elementIds = {
            // Views
            views: ['loading-view', 'url-view', 'options-view', 'separation-view'],
            
            // URL View elements
            'youtubeUrl': 'youtube-url',
            'nextBtn': 'next-btn',
            'clearBtn': 'clear-btn',
            'urlStatus': 'url-status',
            
            // Options View elements
            'videoTitle': 'video-title',
            'downloadPath': 'download-path',
            'browseBtn': 'browse-btn',
            'optionsBackBtn': 'options-back-btn',
            'downloadBtn': 'download-btn',
            'optionsStatus': 'options-status',
            'result': 'result',
            'titleDisplay': 'title-display',
            'pathDisplay': 'path-display',
            
            // Separation View elements
            'inputAudioPath': 'input-audio-path',
            'browseAudioBtn': 'browse-audio-btn',
            'separationOutputPath': 'separation-output-path',
            'browseOutputBtn': 'browse-output-btn',
            'separationBackBtn': 'separation-back-btn',
            'separateStartBtn': 'separate-start-btn',
            'separateCancelBtn': 'separate-cancel-btn',
            'separationStatus': 'separation-status',
            'separationResult': 'separation-result',
            'vocalsPath': 'vocals-path',
            'instrumentalPath': 'instrumental-path',
            
            // Navigation buttons
            'separateBtn': 'separate-btn',
            'resultSeparateBtn': 'result-separate-btn'
        };
        
        // Process views separately to create a nested structure
        this.elements.views = {};
        elementIds.views.forEach(id => {
            this.elements.views[id.replace('-view', '')] = document.getElementById(id);
        });
        
        // Process all other elements
        for (const [key, id] of Object.entries(elementIds)) {
            if (key !== 'views') {
                this.elements[key] = document.getElementById(id);
            }
        }
    },

    setupEventListeners() {
        // Global events
        const globalEvents = [
            { name: 'pywebviewready', handler: () => this.onPywebviewReady() },
            { name: 'download-progress', handler: (e) => this.updateProgress(e.detail) },
            { name: 'separation-progress', handler: (e) => {
                if (!this.state.isSeparationCancelled) {
                    const percent = e.detail;
                    console.log(e.detail);
                    this.showStatus('separation', `Separation in progress... ${percent}%`, 'info');
                }
            }},
            { name: 'settings-loaded', handler: (e) => this.updateSettings(e.detail) }
        ];
        
        // Add global event listeners
        globalEvents.forEach(event => {
            window.addEventListener(event.name, event.handler);
        });
        
        // Element-specific events
        const elementEvents = [
            // URL View
            { element: 'youtubeUrl', event: 'keydown', handler: (e) => {
                if (e.key === 'Enter') this.elements.nextBtn.click();
            }},
            { element: 'nextBtn', event: 'click', handler: () => this.handleNextButton() },
            { element: 'clearBtn', event: 'click', handler: () => this.handleClearButton() },
            
            // Options View
            { element: 'optionsBackBtn', event: 'click', handler: () => this.navigateToView('url-view') },
            { element: 'browseBtn', event: 'click', handler: () => this.handleBrowseButton() },
            { element: 'downloadBtn', event: 'click', handler: () => this.handleDownloadButton() },
            
            // Separation View
            { element: 'separateBtn', event: 'click', handler: () => this.navigateToView('separation-view') },
            { element: 'resultSeparateBtn', event: 'click', handler: () => this.handleResultSeparateButton() },
            { element: 'browseAudioBtn', event: 'click', handler: () => this.handleBrowseAudioButton() },
            { element: 'browseOutputBtn', event: 'click', handler: () => this.handleBrowseOutputButton() },
            { element: 'separationBackBtn', event: 'click', handler: () => this.handleSeparationBackButton() },
            { element: 'separateStartBtn', event: 'click', handler: () => this.handleSeparateStartButton() },
            { element: 'separateCancelBtn', event: 'click', handler: () => this.handleSeparateCancelButton() }
        ];
        
        // Add element event listeners
        elementEvents.forEach(({element, event, handler}) => {
            if (this.elements[element]) {
                this.elements[element].addEventListener(event, handler);
            } else {
                console.warn(`Element ${element} not found for event listener`);
            }
        });
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
        // Reset state of the current view before switching
        const currentViewId = this.state.currentView;
        
        // Reset the view we're navigating away from
        switch (currentViewId) {
            case 'url-view':
                this.resetUrlView();
                break;
            case 'options-view':
                this.resetOptionsView();
                break;
            case 'separation-view':
                this.resetSeparationView();
                break;
        }
        
        // Switch to the new view
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
        // Set input to last downloaded file instead of using default reset
        this.elements.inputAudioPath.value = this.state.lastDownloadedFile || '';
        this.elements.separationOutputPath.value = this.elements.downloadPath.value || '';
        
        // Reset other separation view states
        this.hideStatus('separation');
        this.elements.separationResult.classList.add('hidden');
        this.elements.separateStartBtn.disabled = false;
        this.elements.separateCancelBtn.classList.add('hidden');
        this.state.isSeparationCancelled = false;
        
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

    resetUrlView() {
        this.elements.youtubeUrl.value = this.defaultStates.url.inputValue;
        if (this.defaultStates.url.statusHidden) {
            this.hideStatus('url');
        }
    },

    resetOptionsView() {
        this.elements.videoTitle.textContent = this.defaultStates.options.videoTitle;
        if (this.defaultStates.options.statusHidden) {
            this.hideStatus('options');
        }
        if (this.defaultStates.options.resultHidden) {
            this.elements.result.classList.add('hidden');
        }
        this.elements.downloadBtn.disabled = this.defaultStates.options.downloadButtonDisabled;
    },

    resetSeparationView() {
        // Preserve download path from settings but reset input path
        const preservedOutputPath = this.state.settings?.download_path || '';
        
        this.elements.inputAudioPath.value = this.defaultStates.separation.inputAudioPath;
        this.elements.separationOutputPath.value = preservedOutputPath;
        
        // Always hide status when leaving separation view
        this.hideStatus('separation');
        
        // Hide result area
        this.elements.separationResult.classList.add('hidden');
        
        // Reset button states
        this.elements.separateStartBtn.disabled = this.defaultStates.separation.startButtonDisabled;
        this.elements.separateCancelBtn.classList.add('hidden');
        
        // Reset cancellation state
        this.state.isSeparationCancelled = this.defaultStates.separation.isCancelled;
    },

    // ... other UI methods
};
