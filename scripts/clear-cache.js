/**
 * Script to clear the diagram cache
 * Run with: npm run clear-cache
 */

const fs = require('fs').promises;
const path = require('path');
const fsSync = require('fs');

// Cache directory path
const cacheDir = path.join(__dirname, '../temp/cache');

async function clearCache() {
  try {
    console.log('Clearing diagram cache...');
    
    // Check if cache directory exists
    if (!fsSync.existsSync(cacheDir)) {
      console.log('Cache directory does not exist. Creating it now.');
      await fs.mkdir(cacheDir, { recursive: true });
      console.log('Cache directory created.');
      return;
    }
    
    // Get all files in the cache directory
    const files = await fs.readdir(cacheDir);
    
    if (files.length === 0) {
      console.log('Cache is already empty.');
      return;
    }
    
    console.log(`Found ${files.length} cached files. Removing...`);
    
    // Delete each file
    let deletedCount = 0;
    for (const file of files) {
      if (file.endsWith('.png')) {
        const filePath = path.join(cacheDir, file);
        try {
          await fs.unlink(filePath);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete ${file}: ${error.message}`);
        }
      }
    }
    
    console.log(`Successfully cleared ${deletedCount} cached files.`);
    
  } catch (error) {
    console.error(`Error clearing cache: ${error.message}`);
    process.exit(1);
  }
}

// Execute the function
clearCache();