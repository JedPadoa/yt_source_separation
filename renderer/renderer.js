// SPA View Manager
const viewManager = {
  currentView: 'url-view',
  
  // Data shared between views
  sharedData: {
    youtubeData: {
      url: '',
      title: ''
    },
    audioData: {
      url: '',
      title: '',
      path: ''
    },
    settings: {
      downloadPath: ''
    }
  },
  
  // View state handlers
  viewStates: {
    'url-view': {
      enter: () => {
        hideUrlStatus();
        ButtonState.enable(domElements.nextBtn);
        domElements.youtubeUrl.focus();
      },
      exit: () => {
        hideUrlStatus();
      }
    },
    'options-view': {
      enter: () => {
        hideOptionsStatus();
      },
      exit: () => {
        hideOptionsStatus();
      }
    },
    'separation-view': {
      enter: () => {
        hideSeparationStatus();
      },
      exit: () => {
        resetSeparationViewState();
      }
    }
  },
  
  // Navigate to a specific view
  goToView: function(viewId) {
    // Exit current view
    const currentViewState = this.viewStates[this.currentView];
    if (currentViewState?.exit) {
      currentViewState.exit();
    }
    
    // Hide all views
    DOMCache.getElements('.view').forEach(view => {
      view.classList.remove('active');
    });
    
    // Show requested view
    const view = DOMCache.getElement(viewId);
    if (view) {
      view.classList.add('active');
      this.currentView = viewId;
      
      // Enter new view
      const newViewState = this.viewStates[viewId];
      if (newViewState?.enter) {
        newViewState.enter();
      }
      
      console.log(`Navigated to view: ${viewId}`);
    } else {
      console.error(`View not found: ${viewId}`);
    }
  },
  
  // Update shared data
  updateSharedData: function(key, data) {
    if (key in this.sharedData) {
      this.sharedData[key] = { ...this.sharedData[key], ...data };
    }
  }
};

// DOM Element Cache to avoid repeated getElementById calls
const DOMCache = {
  elements: {},
  selectors: {},
  
  // Get element from cache or DOM if not cached
  getElement: function(id) {
    if (!this.elements[id]) {
      this.elements[id] = document.getElementById(id);
    }
    return this.elements[id];
  },
  
  // Get elements matching a selector from cache or DOM if not cached
  getElements: function(selector) {
    if (!this.selectors[selector]) {
      this.selectors[selector] = document.querySelectorAll(selector);
    }
    return this.selectors[selector];
  }
};

// Pre-cache all elements
const elementIds = [
  // URL view elements
  'youtube-url', 'next-btn', 'clear-btn', 'separate-local-btn', 'url-status',
  
  // Options view elements
  'video-title', 'download-path', 'browse-btn', 'options-back-btn',
  'download-btn', 'local-audio-btn', 'options-status', 'result',
  'title-display', 'path-display',
  
  // Separation view elements
  'audio-path', 'output-path', 'audio-browse-btn', 'output-browse-btn',
  'separation-back-btn', 'separate-btn', 'cancel-btn', 'separation-status',
  'separation-result', 'vocals-result', 'instrumental-result',
  'vocals-path', 'instrumental-path',
  
  // View containers
  'url-view', 'options-view', 'separation-view'
];

// Initialize cache and create variables for all DOM elements
const domElements = {};
elementIds.forEach(id => {
  // Convert kebab-case IDs to camelCase variable names
  const varName = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
  domElements[varName] = DOMCache.getElement(id);
});

// Pre-cache common selectors
const commonSelectors = [
  '.view',
  'input[name="format"]',
  'input[name="quality"]'
];

// Initialize cache and store references for selectors
const domSelectors = {};
commonSelectors.forEach(selector => {
  // Create valid variable names from selectors
  const varName = selector.replace(/[^\w]/g, '') || 'view';
  domSelectors[varName] = DOMCache.getElements(selector);
});

// Default download path
let downloadPath = '';

// Helper functions for UI state management
const hideElement = element => element?.classList.add('hidden');
const showElement = element => element?.classList.remove('hidden');

// Button state management
const ButtonState = {
  enable: (button) => { button.disabled = false; },
  disable: (button) => { button.disabled = true; },
  show: showElement,
  hide: hideElement,
  
  // Enable/disable multiple buttons
  setEnabled: (buttons, enabled) => {
    buttons.forEach(button => button.disabled = !enabled);
  },
  
  // Show/hide multiple buttons
  setVisible: (buttons, visible) => {
    buttons.forEach(button => visible ? showElement(button) : hideElement(button));
  }
};

// Status management system
const StatusManager = {
  // Internal tracking of status states
  states: new Map(),
  
  // Show status message
  show: (element, message, type = 'info') => {
    element.textContent = message;
    element.className = `status ${type} last-element`;
    showElement(element);
    StatusManager.states.set(element, { type, message });
  },
  
  // Hide status message
  hide: (element) => {
    hideElement(element);
    StatusManager.states.delete(element);
  },
  
  // Check if status is in a particular state
  isInState: (element, type) => {
    const state = StatusManager.states.get(element);
    return state?.type === type;
  },
  
  // Clear all status messages
  clearAll: () => {
    [
      domElements.urlStatus,
      domElements.optionsStatus,
      domElements.separationStatus
    ].forEach(element => StatusManager.hide(element));
  }
};

// View-specific status handlers
function showUrlStatus(message, type = 'info') {
  StatusManager.show(domElements.urlStatus, message, type);
}

function hideUrlStatus() {
  StatusManager.hide(domElements.urlStatus);
}

function showOptionsStatus(message, type = 'info') {
  StatusManager.show(domElements.optionsStatus, message, type);
}

function hideOptionsStatus() {
  StatusManager.hide(domElements.optionsStatus);
}

function showSeparationStatus(message, type = 'info') {
  StatusManager.show(domElements.separationStatus, message, type);
}

function hideSeparationStatus() {
  // Don't hide if we're showing separation progress or cancellation
  if (!StatusManager.isInState(domElements.separationStatus, 'separation-in-progress') && 
      !StatusManager.isInState(domElements.separationStatus, 'cancellation')) {
    StatusManager.hide(domElements.separationStatus);
  }
}

// Remove redundant functions
function toggleCancelButton(show) {
  show ? showElement(domElements.cancelBtn) : hideElement(domElements.cancelBtn);
}

// Function to prepare the separation view with data from the download
function prepareForSeparation() {
  // If we have audio data from a download, use it
  if (viewManager.sharedData.audioData.path) {
    domElements.audioPath.value = viewManager.sharedData.audioData.path;
  }
}

// When the page loads
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get settings from backend
    const settings = await window.api.getSettings();
    viewManager.updateSharedData('settings', { downloadPath: settings.download_path });
    domElements.downloadPath.value = settings.download_path;
    domElements.outputPath.value = settings.download_path;
    
    // Set focus to the URL input
    domElements.youtubeUrl.focus();
    
    // Set up download progress handler
    window.api.onDownloadProgress((progress) => {
      console.log(`Download progress: ${JSON.stringify(progress)}`);
      
      // Show download progress in the UI
      if (progress.status === 'downloading') {
        const percent = Math.round(progress.percent || 0);
        let message = `Downloading... ${percent}%`;
        if (progress.speed) {
          message += ` (${progress.speed})`;
        }
        showOptionsStatus(message, 'info');
      } else if (progress.status === 'converting') {
        showOptionsStatus('Converting audio...', 'info');
      }
    });
    
    // Set up separation progress handler - completely ignore all messages
    window.api.onSeparationProgress((message) => {
      // Only show the loading indicator, ignore all incoming messages
      if (!StatusManager.isInState(domElements.separationStatus, 'cancellation')) {
        showSeparationStatus('Separating audio into vocals and instrumental... This may take a while.', 'info');
      }
    });
    
    // Set up separation cancellation handler
    window.api.onSeparationCancelled(() => {
      // Reset button states
      ButtonState.setEnabled([
        domElements.separateBtn,
        domElements.separationBackBtn,
        domElements.cancelBtn
      ], true);
      ButtonState.hide(domElements.cancelBtn);
      
      // Show simple cancellation message
      showSeparationCancelled();
    });
  } catch (error) {
    console.error('Error loading page data:', error);
  }
});

// URL View Event Listeners
domElements.youtubeUrl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    domElements.nextBtn.click();
  }
});

domElements.nextBtn.addEventListener('click', async () => {
  const youtubeUrl = domElements.youtubeUrl.value.trim();
  console.log('Next button clicked with URL:', youtubeUrl);
  
  // Validate input
  if (!youtubeUrl) {
    console.error('Empty YouTube URL');
    showUrlStatus('Please enter a valid YouTube URL', 'error');
    return;
  }
  
  if (!isValidYouTubeUrl(youtubeUrl)) {
    console.error('Invalid YouTube URL');
    showUrlStatus('Please enter a valid YouTube URL', 'error');
    return;
  }
  
  try {
    // Disable button and show validating status
    ButtonState.disable(domElements.nextBtn);
    showUrlStatus('Validating URL...', 'info');
    
    console.log('Calling validateYouTubeUrl with:', youtubeUrl);
    
    // Validate the URL with the backend
    const result = await window.api.validateYouTubeUrl(youtubeUrl);
    console.log('Validation result:', result);
    
    if (result && result.success) {
      console.log('URL validation successful, title:', result.title);
      
      // Update shared data
      viewManager.updateSharedData('youtubeData', {
        url: youtubeUrl,
        title: result.title
      });
      
      // Set the video title in the options view
      domElements.videoTitle.textContent = result.title;
      
      // Navigate to options view
      viewManager.goToView('options-view');
    } else {
      const errorMsg = result ? result.error : 'Unknown validation error';
      console.error('Validation failed:', errorMsg);
      showUrlStatus('Please enter a valid YouTube URL', 'error');
      ButtonState.enable(domElements.nextBtn);
    }
  } catch (error) {
    console.error('Exception during validation:', error);
    showUrlStatus('Please enter a valid YouTube URL', 'error');
    ButtonState.enable(domElements.nextBtn);
  }
});

domElements.youtubeUrl.addEventListener('input', () => {
  hideUrlStatus();
  updateClearButtonState();
});

domElements.clearBtn.addEventListener('click', () => {
  domElements.youtubeUrl.value = '';
  hideUrlStatus();
  updateClearButtonState();
  domElements.youtubeUrl.focus();
});

domElements.separateLocalBtn.addEventListener('click', async () => {
  console.log('Separate local audio button clicked');
  viewManager.goToView('separation-view');
});

// Options View Event Listeners
domElements.browseBtn.addEventListener('click', async () => {
  try {
    // Disable the button while dialog is open to prevent multiple clicks
    domElements.browseBtn.disabled = true;
    
    const result = await window.api.selectDownloadDirectory();
    
    // Re-enable the button
    domElements.browseBtn.disabled = false;
    
    // Handle the result
    if (result.success) {
      downloadPath = result.directory;
      domElements.downloadPath.value = downloadPath;
      hideOptionsStatus();
    } else {
      hideOptionsStatus();
      console.log(result.error || 'No directory selected');
    }
  } catch (error) {
    // Re-enable the button in case of error
    domElements.browseBtn.disabled = false;
    hideOptionsStatus();
    console.error('Failed to select directory:', error);
  }
});

domElements.optionsBackBtn.addEventListener('click', () => {
  viewManager.goToView('url-view');
  // Re-enable the next button when returning to URL view
  domElements.nextBtn.disabled = false;
});

domElements.downloadBtn.addEventListener('click', async () => {
  try {
    // Get selected options
    const format = getSelectedRadioValue(domSelectors.inputnameformat, 'mp3');
    const quality = getSelectedRadioValue(domSelectors.inputnamequality, 'high');
    const outputDir = domElements.downloadPath.value.trim();
    
    // Validate inputs
    if (!outputDir) {
      console.error('No download location selected');
      showOptionsStatus('Please select a download location', 'error');
      return;
    }
    
    // Disable buttons and show initial status
    ButtonState.setEnabled([domElements.downloadBtn, domElements.optionsBackBtn], false);
    showOptionsStatus('Starting download...', 'info');
    
    // Start download
    const options = {
      url: viewManager.sharedData.youtubeData.url,
      format_type: format,
      quality: quality,
      output_dir: outputDir
    };
    
    const result = await window.api.downloadAudio(options);
    
    if (result.success) {
      // Hide the status message since we're showing the result
      hideOptionsStatus();
      // Display the download result
      showResult(
        `TITLE: ${result.title}`,
        `SAVED: ${result.path}`
      );
    } else {
      console.error(`Download failed: ${result.error}`);
      showOptionsStatus('Download failed. Please try again.', 'error');
    }
    
    // Re-enable buttons
    ButtonState.setEnabled([domElements.downloadBtn, domElements.optionsBackBtn], true);
  } catch (error) {
    console.error('Error during download:', error);
    showOptionsStatus('Download failed. Please try again.', 'error');
    
    // Re-enable buttons
    ButtonState.setEnabled([domElements.downloadBtn, domElements.optionsBackBtn], true);
  }
});

domElements.localAudioBtn.addEventListener('click', () => {
  viewManager.goToView('separation-view');
});

// Generic browse operation error handler
async function handleBrowseOperation(operation, buttonElement, onSuccess) {
  // Don't allow browsing during separation
  if (domElements.separationStatus.classList.contains('separation-in-progress')) {
    return;
  }
  
  try {
    // Disable the button while dialog is open
    buttonElement.disabled = true;
    
    const result = await operation();
    
    // Re-enable the button
    buttonElement.disabled = false;
    
    if (result.success) {
      onSuccess(result);
      hideSeparationStatus();
    } else {
      console.log(result.error || 'No selection made');
    }
  } catch (error) {
    // Re-enable the button in case of error
    buttonElement.disabled = false;
    console.error('Operation failed:', error);
  }
}

// Separation View Event Listeners
domElements.audioBrowseBtn.addEventListener('click', () => {
  handleBrowseOperation(
    window.api.selectAudioFile,
    domElements.audioBrowseBtn,
    result => domElements.audioPath.value = result.filePath
  );
});

domElements.outputBrowseBtn.addEventListener('click', () => {
  handleBrowseOperation(
    window.api.selectDownloadDirectory,
    domElements.outputBrowseBtn,
    result => domElements.outputPath.value = result.directory
  );
});

domElements.separationBackBtn.addEventListener('click', () => {
  // Don't allow navigation during separation
  if (domElements.separationStatus.classList.contains('separation-in-progress')) {
    return;
  }
  
  // Always go back to URL view
  viewManager.goToView('url-view');
});

domElements.separateBtn.addEventListener('click', async () => {
  try {
    const audioPath = domElements.audioPath.value.trim();
    const outputDir = domElements.outputPath.value.trim();
    
    // Validate inputs
    if (!audioPath) {
      console.error('Please select an audio file to separate');
      showSeparationStatus('Please select an audio file to separate', 'error');
      return;
    }
    
    if (!outputDir) {
      console.error('Please select an output directory');
      showSeparationStatus('Please select an output directory', 'error');
      return;
    }
    
    // Update button states
    ButtonState.disable(domElements.separateBtn);
    ButtonState.disable(domElements.separationBackBtn);
    ButtonState.show(domElements.cancelBtn);
    
    // Clear previous results
    hideSeparationResult();
    
    // Show separation in progress
    showSeparationStatus('Separating audio into vocals and instrumental... This may take a while.', 'info');
    
    // Start separation process
    const result = await window.api.separateAudio({ 
      audioPath: audioPath, 
      output_dir: outputDir 
    });
    
    // Check if separation was successful
    if (result.success) {
      // Show the results
      showSeparationResult({
        vocals: result.files.vocals,
        instrumental: result.files.instrumental
      });
    } else if (result.cancelled) {
      // If cancelled, this is handled by the cancellation event handler
      showSeparationCancelled();
    } else {
      console.error(`Separation failed: ${result.error || 'Unknown error'}`);
      showSeparationStatus('Separation failed. Please try again.', 'error');
    }
    
    // Reset button states
    ButtonState.enable(domElements.separateBtn);
    ButtonState.enable(domElements.separationBackBtn);
    ButtonState.hide(domElements.cancelBtn);
  } catch (error) {
    console.error('Error during separation:', error);
    showSeparationStatus('Separation failed. Please try again.', 'error');
    
    // Reset button states
    ButtonState.enable(domElements.separateBtn);
    ButtonState.enable(domElements.separationBackBtn);
    ButtonState.hide(domElements.cancelBtn);
  }
});

domElements.cancelBtn.addEventListener('click', async () => {
  try {
    // Disable the cancel button to prevent multiple clicks
    domElements.cancelBtn.disabled = true;
    
    // Show cancellation message
    showSeparationStatus('Cancelling separation...', 'info');
    
    // Send cancel request to the main process
    await window.api.cancelSeparation();
    
    // Don't hide the cancel button yet as the process might take a moment to fully cancel
  } catch (error) {
    console.error('Error cancelling separation:', error);
    // Re-enable the cancel button if there was an error
    domElements.cancelBtn.disabled = false;
  }
});

// Special case helper functions
function showSeparationInProgress() {
  showSeparationStatus('Separating audio into vocals and instrumental... This may take a while.', 'info');
}

function showSeparationCancelled() {
  showSeparationStatus('Separation cancelled', 'error');
  // Flag that we're in a cancelled state (prevents other content from showing)
  domElements.separationStatus.dataset.cancelled = 'true';
}

function showSeparationResult(results) {
  // If separation was cancelled, don't show results
  if (domElements.separationStatus.dataset.cancelled === 'true') {
    return;
  }
  
  // Hide status
  hideSeparationStatus();
  
  // Show result container
  showElement(domElements.separationResult);
  
  // Show vocals result if available
  if (results.vocals) {
    showElement(domElements.vocalsResult);
    domElements.vocalsPath.textContent = results.vocals;
  } else {
    hideElement(domElements.vocalsResult);
  }
  
  // Show instrumental result if available
  if (results.instrumental) {
    showElement(domElements.instrumentalResult);
    domElements.instrumentalPath.textContent = results.instrumental;
  } else {
    hideElement(domElements.instrumentalResult);
  }
}

// Function to completely reset the separation view state
function resetSeparationViewState() {
  // Reset form inputs
  if (!viewManager.sharedData.audioData.path) {
    // Only clear the audio path if it wasn't set from a download
    domElements.audioPath.value = '';
  }
  
  // Hide all status and result elements
  hideElement(domElements.separationStatus);
  hideElement(domElements.separationResult);
  hideElement(domElements.vocalsResult);
  hideElement(domElements.instrumentalResult);
  
  // Clear any cancelled state
  delete domElements.separationStatus.dataset.cancelled;
  
  // Enable buttons in case they were disabled
  domElements.separateBtn.disabled = false;
  domElements.separationBackBtn.disabled = false;
  
  // Hide cancel button AND ensure it's not disabled for future use
  hideElement(domElements.cancelBtn);
  domElements.cancelBtn.disabled = false;
}

function getSelectedRadioValue(radioGroup, defaultValue) {
  for (const radio of radioGroup) {
    if (radio.checked) {
      return radio.value;
    }
  }
  return defaultValue;
}

function showResult(title, path) {
  // Hide status
  hideOptionsStatus();
  
  // Set content directly for better performance
  domElements.titleDisplay.textContent = title;
  domElements.pathDisplay.textContent = path;
  
  // Show result container
  showElement(domElements.result);

  // Update shared data
  viewManager.updateSharedData('audioData', {
    url: viewManager.sharedData.youtubeData.url,
    title: viewManager.sharedData.youtubeData.title,
    path: path.replace('SAVED: ', '') // Remove the "SAVED: " prefix
  });
  
  // Add a "Separate Audio" button after the path display immediately
  const separateBtn = document.createElement('button');
  separateBtn.textContent = 'SEPARATE AUDIO';
  separateBtn.classList.add('separate-btn');
  separateBtn.style.marginTop = '15px';
  separateBtn.style.display = 'block';
  separateBtn.style.width = '100%';
  separateBtn.onclick = async () => {
    // If we have audio data from a download, use it
    if (viewManager.sharedData.audioData.path) {
      domElements.audioPath.value = viewManager.sharedData.audioData.path;
    }
    viewManager.goToView('separation-view');
  };
  
  // Remove any existing button before adding a new one
  const existingBtn = domElements.result.querySelector('.separate-btn');
  if (existingBtn) {
    domElements.result.removeChild(existingBtn);
  }
  domElements.result.appendChild(separateBtn);
}

function updateClearButtonState() {
  const hasInput = domElements.youtubeUrl.value.trim().length > 0;
  domElements.clearBtn.disabled = !hasInput;
}

function isValidYouTubeUrl(url) {
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  return pattern.test(url);
}

// Helper functions for Separation view
function hideSeparationResult() {
  hideElement(domElements.separationResult);
  hideElement(domElements.vocalsResult);
  hideElement(domElements.instrumentalResult);
} 