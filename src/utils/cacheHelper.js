const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../config/logger');

// Cache directory path
const cacheDir = path.join(__dirname, '../../temp/cache');

/**
 * Helper utility for caching diagram conversions
 */
class CacheHelper {
  constructor(options = {}) {
    this.logger = options.logger || logger;
    this.silent = options.silent || false;
    this.maxCacheSize = options.maxCacheSize || 100; // Maximum number of cached items
    this.cacheTTL = options.cacheTTL || 24 * 60 * 60 * 1000; // Cache TTL in ms (default: 24 hours)
    
    // In-memory cache metadata to avoid excessive disk operations
    this.cacheIndex = {
      items: new Map(), // Maps hash to { timestamp, filePath } objects
      accessOrder: [] // Tracks LRU order
    };
    
    // Initialize the cache directory and index
    this.initializeCache().catch(err => {
      if (!this.silent) {
        this.logger.error(`Cache initialization error: ${err.message}`);
      }
    });
  }

  /**
   * Initialize cache directory and load the cache index
   */
  async initializeCache() {
    // Ensure the cache directory exists
    await this.ensureCacheDirExists();
    
    // Load existing cache metadata
    await this.loadCacheIndex();
    
    // Clean up expired items
    await this.cleanExpiredCache();
    
    if (!this.silent) {
      this.logger.log(`Cache initialized with ${this.cacheIndex.items.size} items`);
    }
  }
  
  /**
   * Ensure cache directory exists
   */
  async ensureCacheDirExists() {
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      return true;
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error creating cache directory: ${error.message}`);
      }
      return false;
    }
  }
  
  /**
   * Load the cache index from disk
   */
  async loadCacheIndex() {
    try {
      // Get all files in the cache directory
      const files = await fs.readdir(cacheDir);
      
      // Process each PNG file in the cache
      for (const file of files) {
        if (file.endsWith('.png')) {
          const hash = path.basename(file, '.png');
          const filePath = path.join(cacheDir, file);
          
          try {
            const stats = await fs.stat(filePath);
            
            // Add to cache index
            this.cacheIndex.items.set(hash, {
              timestamp: stats.mtime.getTime(),
              filePath
            });
            
            // Add to access order
            this.cacheIndex.accessOrder.push(hash);
          } catch (statError) {
            // Skip files with issues
            if (!this.silent) {
              this.logger.error(`Error accessing cache file ${file}: ${statError.message}`);
            }
          }
        }
      }
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error loading cache index: ${error.message}`);
      }
      
      // Initialize empty cache on error
      this.cacheIndex = { items: new Map(), accessOrder: [] };
    }
  }
  
  /**
   * Clean expired cache items
   */
  async cleanExpiredCache() {
    const now = Date.now();
    const expiredHashes = [];
    
    // Find expired items
    for (const [hash, metadata] of this.cacheIndex.items.entries()) {
      if (now - metadata.timestamp > this.cacheTTL) {
        expiredHashes.push(hash);
      }
    }
    
    // Remove expired items
    for (const hash of expiredHashes) {
      try {
        const filePath = this.cacheIndex.items.get(hash).filePath;
        await fs.unlink(filePath);
        
        // Remove from index
        this.cacheIndex.items.delete(hash);
        this.cacheIndex.accessOrder = this.cacheIndex.accessOrder.filter(h => h !== hash);
        
        if (!this.silent) {
          this.logger.debug(`Removed expired cache item: ${hash}`);
        }
      } catch (error) {
        if (!this.silent) {
          this.logger.error(`Error removing expired cache item ${hash}: ${error.message}`);
        }
      }
    }
    
    // If cache is still too large, remove least recently used items
    while (this.cacheIndex.items.size > this.maxCacheSize) {
      await this.removeOldestCacheItem();
    }
  }
  
  /**
   * Remove the oldest (least recently used) cache item
   */
  async removeOldestCacheItem() {
    if (this.cacheIndex.accessOrder.length === 0) return;
    
    const oldestHash = this.cacheIndex.accessOrder.shift();
    
    try {
      const filePath = this.cacheIndex.items.get(oldestHash).filePath;
      await fs.unlink(filePath);
      
      // Remove from index
      this.cacheIndex.items.delete(oldestHash);
      
      if (!this.silent) {
        this.logger.debug(`Removed LRU cache item: ${oldestHash}`);
      }
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error removing LRU cache item ${oldestHash}: ${error.message}`);
      }
    }
  }
  
  /**
   * Generate a hash key for a diagram
   * @param {string} mermaidSyntax - The Mermaid diagram syntax
   * @param {Object} options - Rendering options like width and height
   * @returns {string} - A cache key hash
   */
  generateCacheKey(mermaidSyntax, options = {}) {
    // Include options in the hash to cache different sizes separately
    const { width, height } = options;
    const hashInput = `${mermaidSyntax}|w:${width || 'default'}|h:${height || 'default'}`;
    
    return crypto.createHash('md5').update(hashInput).digest('hex');
  }
  
  /**
   * Check if an item exists in cache and is valid
   * @param {string} hash - The cache key hash
   * @returns {boolean} - Whether the item is in cache
   */
  async isCached(hash) {
    // Check if the hash exists in our index
    if (!this.cacheIndex.items.has(hash)) {
      return false;
    }
    
    // Get the file path
    const { filePath, timestamp } = this.cacheIndex.items.get(hash);
    
    // Check if the file exists and is not expired
    try {
      await fs.access(filePath);
      
      const now = Date.now();
      if (now - timestamp > this.cacheTTL) {
        // Expired - remove from cache
        this.cacheIndex.items.delete(hash);
        this.cacheIndex.accessOrder = this.cacheIndex.accessOrder.filter(h => h !== hash);
        await fs.unlink(filePath).catch(() => {});
        return false;
      }
      
      return true;
    } catch (error) {
      // File doesn't exist or can't be accessed
      this.cacheIndex.items.delete(hash);
      this.cacheIndex.accessOrder = this.cacheIndex.accessOrder.filter(h => h !== hash);
      return false;
    }
  }
  
  /**
   * Update access time for an item (mark as recently used)
   * @param {string} hash - The cache key hash
   */
  updateAccessTime(hash) {
    // Remove from current position in access order
    this.cacheIndex.accessOrder = this.cacheIndex.accessOrder.filter(h => h !== hash);
    
    // Add to end (most recently used)
    this.cacheIndex.accessOrder.push(hash);
    
    // Update timestamp
    if (this.cacheIndex.items.has(hash)) {
      const item = this.cacheIndex.items.get(hash);
      item.timestamp = Date.now();
      this.cacheIndex.items.set(hash, item);
    }
  }
  
  /**
   * Get a cached item
   * @param {string} hash - The cache key hash
   * @returns {Promise<Buffer|null>} - The cached image buffer or null
   */
  async getCachedItem(hash) {
    // Check if the item is in cache
    const isCached = await this.isCached(hash);
    if (!isCached) {
      return null;
    }
    
    try {
      // Get the file path
      const { filePath } = this.cacheIndex.items.get(hash);
      
      // Update access time
      this.updateAccessTime(hash);
      
      // Read the file
      const buffer = await fs.readFile(filePath);
      
      if (!this.silent) {
        this.logger.debug(`Cache hit: ${hash}`);
      }
      
      return buffer;
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error reading cached item ${hash}: ${error.message}`);
      }
      
      return null;
    }
  }
  
  /**
   * Cache an item
   * @param {string} hash - The cache key hash
   * @param {Buffer} buffer - The image buffer
   */
  async cacheItem(hash, buffer) {
    try {
      // Ensure cache directory exists
      await this.ensureCacheDirExists();
      
      // Create the file path
      const filePath = path.join(cacheDir, `${hash}.png`);
      
      // Write the buffer to file
      await fs.writeFile(filePath, buffer);
      
      // Add to cache index
      this.cacheIndex.items.set(hash, {
        timestamp: Date.now(),
        filePath
      });
      
      // Add to access order
      this.cacheIndex.accessOrder.push(hash);
      
      // Clean up if cache is too large
      if (this.cacheIndex.items.size > this.maxCacheSize) {
        await this.removeOldestCacheItem();
      }
      
      if (!this.silent) {
        this.logger.debug(`Cached item: ${hash}`);
      }
      
      return true;
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error caching item ${hash}: ${error.message}`);
      }
      
      return false;
    }
  }
}

module.exports = CacheHelper;