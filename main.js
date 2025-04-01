const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { PythonShell } = require('python-shell');


// Keep a global reference of the window object to avoid garbage collection
let mainWindow = null;

// Global variable to store the current separation process
let currentSeparationProcess = null;

// Get the path to the Python executable/script based on environment
function getPythonPath() {
  if (process.env.NODE_ENV === 'development') {
    return {
      command: process.platform === 'win32' ? 'python' : 'python3',
      script: path.join(__dirname, 'python', 'engine.py')
    };
  } else {
    // In production, use the bundled executable
    const executableExtension = process.platform === 'win32' ? '.exe' : '';
    return {
      command: path.join(process.resourcesPath, 'python', 'engine' + executableExtension),
      script: null
    };
  }
}

// Create and set up the main window
function createWindow() {
  // Create the browser window with custom styling for retro terminal look
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: '#000000', // Black background for terminal theme
    title: 'YouTube Audio Downloader',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the Single Page Application HTML file
  try {
    // First try to load from the renderer directory
    const indexPathRenderer = path.join(__dirname, 'renderer', 'index.html');
    const indexPathRoot = path.join(__dirname, 'index.html');
    
    // Determine which path to use
    const indexPath = fs.existsSync(indexPathRenderer) 
      ? indexPathRenderer 
      : indexPathRoot;
    
    if (!fs.existsSync(indexPath)) {
      throw new Error(`SPA HTML file not found at ${indexPath}`);
    }
    
    console.log(`Loading SPA from: ${indexPath}`);
    mainWindow.loadFile(indexPath);
    
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } catch (error) {
    console.error(`Error loading initial page: ${error.message}`);
    // Show an error screen
    mainWindow.loadURL(`data:text/html,
      <html>
      <body style="background: black; color: red; font-family: monospace; padding: 2em;">
        <h2>Error Loading Application</h2>
        <p>${error.message}</p>
      </body>
      </html>
    `);
  }
}

// Run a Python script and return its output
function runPythonScript(scriptName, args, progressCallback = null) {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();
    console.log(`Running Python with args: ${args.join(', ')}`);
    
    // In development, we run the .py file, in production we run the executable directly
    const processArgs = pythonPath.script ? [pythonPath.script, ...args] : args;
    const pythonProcess = spawn(pythonPath.command, processArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[STDOUT] ${output.trim()}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      
      // Check if this is a progress update
      if (progressCallback && output.includes('PROGRESS:')) {
        try {
          const progressMatch = output.match(/PROGRESS: (.*)/);
          if (progressMatch && progressMatch[1]) {
            const progressData = JSON.parse(progressMatch[1]);
            progressCallback(progressData);
          }
        } catch (error) {
          console.error(`Failed to parse progress data: ${error.message}`);
        }
      } else {
        console.error(`[STDERR] ${output.trim()}`);
      }
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Process exited with code ${code}`);
      
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        // Find the first JSON object in the output
        const jsonMatch = stdout.match(/\{.*\}/s);
        if (jsonMatch) {
          const jsonString = jsonMatch[0];
          const jsonResult = JSON.parse(jsonString);
          resolve(jsonResult);
        } else {
          console.log(`No JSON found in Python output`);
          reject(new Error('No JSON found in Python output'));
        }
      } catch (error) {
        console.error(`Failed to parse Python output as JSON: ${error.message}`);
        reject(new Error('Failed to parse Python output'));
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(`Process error: ${error.message}`);
      reject(error);
    });
  });
}

// Called when Electron has finished initialization
app.whenReady().then(async () => {
  createWindow();
  
  // On macOS, recreate a window when dock icon is clicked and no windows are open
  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});

// Handle IPC messages from renderer process

// Validate a YouTube URL
ipcMain.handle('validate-youtube-url', async (event, url) => {
  console.log(`Validating URL: ${url}`);
  
  try {
    // Run the validation
    const result = await runPythonScript('engine.py', ['validate_url', url]);
    
    // Only log success or failure, not the entire result
    if (result.success) {
      console.log(`URL validation successful: ${result.title}`);
    } else {
      console.log(`URL validation failed: ${result.error || 'Unknown error'}`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error validating URL: ${error.message}`);
    return { 
      success: false, 
      error: error.message || 'Failed to validate URL' 
    };
  }
});

// Get application settings
ipcMain.handle('get-settings', async () => {
  console.log('Getting settings');
  try {
    const result = await runPythonScript('engine.py', ['get_settings']);
    return result;
  } catch (error) {
    console.error(`Error getting settings: ${error.message}`);
    return { download_path: app.getPath('downloads') };
  }
});

// Download audio from YouTube
ipcMain.handle('download-audio', async (event, options) => {
  const { url, format_type, quality, output_dir } = options;
  console.log(`Starting audio download: ${url}, format: ${format_type}, quality: ${quality}, output directory: ${output_dir}`);
  
  try {
    // Run the Python download function with progress updates
    const result = await runPythonScript(
      'engine.py', 
      ['download_audio', url, output_dir, format_type, quality],
      (progressData) => {
        // Only send clean, filtered progress updates to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          // Make sure we only send a clean object with expected properties
          const safeProgressData = {
            status: progressData.status || 'downloading',
            percent: progressData.percent || 0,
            speed: progressData.speed || 0,
            eta: progressData.eta || 0
          };
          
          // Send the sanitized progress data
          mainWindow.webContents.send('download-progress', safeProgressData);
        }
      }
    );
    
    // Save the settings after successful download
    if (result.success) {
      runPythonScript('engine.py', ['save_settings', output_dir]);
    }
    
    return result;
  } catch (error) {
    console.error(`Error downloading audio: ${error.message}`);
    return { success: false, error: error.message || 'Failed to download audio' };
  }
});

// Select download directory
ipcMain.handle('select-directory', async () => {
  console.log('Opening directory selection dialog');
  try {
    // Bring the window to front before opening dialog
    if (mainWindow) {
      mainWindow.focus();
    }
    
    // Use Electron's native dialog instead of Python
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Download Directory',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select',
      defaultPath: app.getPath('downloads')
    });
    
    if (result.canceled) {
      return { success: false, error: 'No directory selected' };
    } else {
      // If directory was selected, save it to settings
      const selectedDir = result.filePaths[0];
      
      // Save the selected directory to settings
      try {
        await runPythonScript('engine.py', ['save_settings', selectedDir]);
      } catch (error) {
        console.warn(`Warning: Could not save directory to settings: ${error.message}`);
        // Continue anyway since we have the directory
      }
      
      return { success: true, directory: selectedDir };
    }
  } catch (error) {
    console.error(`Error selecting directory: ${error.message}`);
    return { success: false, error: 'Failed to open directory selection dialog' };
  }
});

// Handle audio separation request
ipcMain.handle('separate-audio', async (event, options) => {
  try {
    const { audioPath, output_dir } = options;
    console.log(`Starting source separation for file: ${audioPath}, output dir: ${output_dir}`);
    
    // Check if audio file exists
    try {
      await fs.promises.access(audioPath, fs.constants.F_OK);
    } catch (error) {
      console.log(`Audio file does not exist: ${audioPath}`);
      return { success: false, error: `Audio file not found: ${audioPath}` };
    }
    
    // Check if output directory exists, create if not
    try {
      await fs.promises.access(output_dir, fs.constants.F_OK);
    } catch (error) {
      console.log(`Output directory does not exist: ${output_dir}, creating...`);
      await fs.promises.mkdir(output_dir, { recursive: true });
    }

    return await new Promise((resolve, reject) => {
      const pythonPath = getPythonPath();
      const processArgs = pythonPath.script 
        ? [pythonPath.script, 'separate_audio', audioPath, 'mp3', output_dir]
        : ['separate_audio', audioPath, 'mp3', output_dir];
      
      // Start separation process with standard I/O passed through to terminal
      const pythonProcess = spawn(pythonPath.command, processArgs, {
        stdio: 'inherit' // This passes stdout and stderr directly to the parent process (terminal)
      });
      
      // Store the current process so it can be cancelled
      currentSeparationProcess = pythonProcess;
      
      let wasCancelled = false;
      
      pythonProcess.on('close', (code) => {
        // Clear the current process reference
        currentSeparationProcess = null;
        
        if (wasCancelled) {
          resolve({
            success: false,
            cancelled: true,
            error: 'Separation was cancelled'
          });
          return;
        }
        
        if (code === 0) {
          // Get the base filename without extension
          const baseName = path.basename(audioPath, path.extname(audioPath));
          
          // Construct the expected output paths based on your Python script's behavior
          const vocalsPath = path.join(output_dir, `${baseName}/vocals.wav`);
          const instrumentalPath = path.join(output_dir, `${baseName}/no_vocals.wav`);
          
          resolve({
            success: true,
            files: {
              vocals: vocalsPath,
              instrumental: instrumentalPath
            }
          });
        } else {
          // Just return a generic message
          resolve({
            success: false,
            error: 'Separation failed.'
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error(`Process error: ${error.message}`);
        
        currentSeparationProcess = null;
        reject(new Error('Separation process failed to start'));
      });
      
      // Handle cancellation
      event.sender.on('canceled', () => {
        if (currentSeparationProcess) {
          wasCancelled = true;
          // This will trigger the close event
          currentSeparationProcess.kill();
        }
      });
    });
  } catch (error) {
    console.error(`Unexpected error in separate-audio: ${error.message}`);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
});

// Handle separation cancellation
ipcMain.handle('cancel-separation', async (event) => {
  console.log('Cancellation requested');
  
  if (currentSeparationProcess) {
    try {
      // Immediately set wasCancelled flag on the process if possible
      if (currentSeparationProcess.wasCancelled !== undefined) {
        currentSeparationProcess.wasCancelled = true;
      }
      
      // Disable any further stderr/stdout processing
      if (currentSeparationProcess.stdout) {
        currentSeparationProcess.stdout.removeAllListeners();
      }
      if (currentSeparationProcess.stderr) {
        currentSeparationProcess.stderr.removeAllListeners();
      }
      
      // Try graceful termination first (SIGTERM)
      console.log('Attempting graceful termination with SIGTERM');
      currentSeparationProcess.kill('SIGTERM');
      
      // Set a timeout to force kill if not terminated within 3 seconds
      const killTimeout = setTimeout(() => {
        if (currentSeparationProcess) {
          console.log('Process did not terminate gracefully, forcing kill with SIGKILL');
          currentSeparationProcess.kill('SIGKILL');
        }
      }, 3000);
      
      // Setup one-time close handler to clear the timeout if process ends naturally
      currentSeparationProcess.once('close', () => {
        console.log('Process terminated');
        clearTimeout(killTimeout);
      });
      
      // Notify the renderer but with absolutely no process output
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('separation-cancelled');
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error during cancellation: ${error.message}`);
      return { success: false, error: 'Failed to cancel process' };
    }
  } else {
    console.log('No active process to cancel');
    return { success: false, error: 'No active process' };
  }
});

// Select audio file for separation
ipcMain.handle('select-audio-file', async () => {
  console.log('Opening audio file selection dialog');
  try {
    // Bring the window to front before opening dialog
    if (mainWindow) {
      mainWindow.focus();
    }
    
    // Use Electron's native dialog for file selection
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Audio File',
      properties: ['openFile'],
      buttonLabel: 'Select',
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a'] }
      ],
      defaultPath: app.getPath('music')
    });
    
    if (result.canceled) {
      return { success: false, error: 'No file selected' };
    } else {
      const selectedFile = result.filePaths[0];
      console.log(`Selected audio file: ${selectedFile}`);
      
      // Verify that the file exists and is readable
      try {
        await fs.promises.access(selectedFile, fs.constants.F_OK | fs.constants.R_OK);
        return { success: true, filePath: selectedFile };
      } catch (error) {
        console.error(`Error accessing selected file: ${error.message}`);
        return { success: false, error: 'Cannot access the selected file' };
      }
    }
  } catch (error) {
    console.error(`Error selecting audio file: ${error.message}`);
    return { success: false, error: 'Failed to open file selection dialog' };
  }
});