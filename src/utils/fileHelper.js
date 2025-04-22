const fs = require('fs');
const path = require('path');

const tempDir = path.join(__dirname, '../../temp');

// Logger configuration
let silent = false;
let logger = console;

// Create a temporary file and return its path
async function createTempFile(content) {
  ensureDirExistsSync(tempDir);
  const tempFilePath = path.join(tempDir, `temp-${Date.now()}.mmd`);
  await fs.promises.writeFile(tempFilePath, content, 'utf8');
  return tempFilePath;
}

// Delete a file at the specified path
async function deleteFile(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (!silent) {
      logger.error(`Error deleting file ${filePath}: ${error.message}`);
    }
  }
}

// Synchronous version - immediately creates the directory if it doesn't exist
function ensureDirExistsSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    if (!silent) {
      logger.log(`Created directory: ${dirPath}`);
    }
  }
  return true;
}

// Async version - checks if a directory exists, and creates it if it doesn't
async function ensureDirExists(dirPath) {
  try {
    // Use the sync version for reliability
    return ensureDirExistsSync(dirPath);
  } catch (error) {
    if (!silent) {
      logger.error(`Error ensuring directory exists: ${error.message}`);
    }
    return false;
  }
}

// Configure logging behavior
function configure(options = {}) {
  if (options.silent !== undefined) {
    silent = options.silent;
  }
  if (options.logger) {
    logger = options.logger;
  }
}

module.exports = {
  createTempFile,
  deleteFile,
  ensureDirExists,
  ensureDirExistsSync,
  configure
};