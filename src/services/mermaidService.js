const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const { ensureDirExistsSync } = require('../utils/fileHelper');
const CacheHelper = require('../utils/cacheHelper');
const logger = require('../config/logger');

class MermaidService {
  constructor(options = {}) {
    this.logger = options.logger || logger;
    this.silent = options.silent || false;
    
    // Default dimensions - Full HD resolution
    this.defaultWidth = 1920;  // Full HD width
    this.defaultHeight = 1080; // Full HD height
    
    // Initialize cache helper with the same logging options
    this.cacheHelper = new CacheHelper({
      silent: this.silent,
      logger: this.logger,
      maxCacheSize: options.maxCacheSize || 100,
      cacheTTL: options.cacheTTL || 24 * 60 * 60 * 1000 // 24 hours by default
    });
  }

  async createTempMermaidFile(code, tempFilePath) {
    // Clean up the mermaid code to ensure it's properly formatted
    const cleanedCode = this.cleanMermaidSyntax(code);
    
    // Write the raw mermaid code directly to a file
    // The mermaid-cli will convert it to HTML internally
    await fs.writeFile(tempFilePath, cleanedCode, 'utf8');
    
    if (!this.silent) {
      this.logger.log(`Created temporary mermaid file: ${tempFilePath}`);
      // Log a preview of the content for debugging
      this.logger.debug(`Mermaid code preview: ${cleanedCode.substring(0, 100)}${cleanedCode.length > 100 ? '...' : ''}`);
    }
  }
  
  // Helper method to clean up and normalize Mermaid syntax
  cleanMermaidSyntax(code) {
    if (!code) return '';

    // Remove escaped newlines and replace with actual newlines
    let cleaned = code.replace(/\\n/g, '\n');
    
    // Fix common syntax issues with whitespace and broken lines
    cleaned = cleaned.replace(/\s+:/g, ' :'); // Fix spaces before colons
    cleaned = cleaned.replace(/,\s+/g, ', '); // Normalize spaces after commas
    
    // Fix dates with extra dashes
    cleaned = cleaned.replace(/(\d{4})-(\d{2})-+(\d{2})/g, '$1-$2-$3');
    
    // Remove any extra spaces in the middle of task definitions
    cleaned = cleaned.replace(/(\w+)\s+,\s+(\w+)/g, '$1, $2');
    
    // Special handling for Gantt charts
    if (cleaned.trim().startsWith('gantt')) {
      // Add necessary header for Gantt charts
      cleaned = this.fixGanttSyntax(cleaned);
    }
    
    // For class diagrams, ensure proper arrow syntax and fix common issues
    if (cleaned.trim().startsWith('classDiagram')) {
      cleaned = cleaned.replace(/-->/g, ' --> ');  // Fix arrows
      cleaned = cleaned.replace(/<--/g, ' <-- ');  // Fix arrows
    }
    
    return cleaned;
  }
  
  // Special function to fix Gantt chart syntax
  fixGanttSyntax(ganttCode) {
    // Make sure gantt is indented correctly
    let fixed = ganttCode.trim();
    
    // Ensure the correct dateFormat is specified
    if (!fixed.includes('dateFormat')) {
      const dateFormatLine = "    dateFormat  YYYY-MM-DD";
      fixed = fixed.replace(/gantt([\s\S]*?)(\n\s*section|$)/, `gantt$1\n${dateFormatLine}$2`);
    }
    
    // Fix any missing spaces after section declarations
    fixed = fixed.replace(/section(\w+)/g, 'section $1');
    
    // Add proper spacing for task definitions
    fixed = fixed.replace(/:(\w+),/g, ': $1, ');
    
    // Fix "after" syntax
    fixed = fixed.replace(/after(\w+)/g, 'after $1');
    
    // Fix multiple 'after' conditions which can cause rendering problems
    fixed = fixed.replace(/after\s+([^,]+),\s*after\s+([^,]+)/g, 'after $1 & $2');
    
    // Add proper indentation to all sections
    const lines = fixed.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('section')) {
        lines[i] = lines[i].trim();
      } else if (!lines[i].trim().startsWith('gantt') && 
                !lines[i].trim().startsWith('title') &&
                !lines[i].trim().startsWith('dateFormat')) {
        // Add 4 spaces indentation for task items
        if (lines[i].trim() !== '' && !lines[i].startsWith('    ')) {
          lines[i] = '    ' + lines[i].trim();
        }
      }
    }
    
    return lines.join('\n');
  }

  async convertToPng(inputFile, outputFile, options = {}) {
    try {
      // Use provided dimensions or fallback to defaults
      const width = options.width || this.defaultWidth;
      const height = options.height || this.defaultHeight;
      
      // Reference to config files
      const puppeteerConfigPath = path.resolve(__dirname, '../config/puppeteer-config.json');
      const mermaidConfigPath = path.resolve(__dirname, '../config/mermaid.config.json');
      
      // Read input file to check if it's a Gantt chart
      const inputContent = await fs.readFile(inputFile, 'utf-8');
      const isGanttChart = inputContent.trim().startsWith('gantt');
      
      // Default command
      let command = `npx mmdc -i "${inputFile}" -o "${outputFile}" -w ${width} -H ${height} -p "${puppeteerConfigPath}" -c "${mermaidConfigPath}" --backgroundColor "#ffffff"`;
      
      // For Gantt charts, use a specific version parameter if needed
      if (isGanttChart) {
        // Use a known-compatible mermaid version
        command = `npx mmdc -i "${inputFile}" -o "${outputFile}" -w ${width} -H ${height} -p "${puppeteerConfigPath}" -c "${mermaidConfigPath}" --backgroundColor "#ffffff"`;
      }
      
      if (!this.silent) {
        this.logger.log(`Converting ${inputFile} to ${outputFile}...`);
        this.logger.log(`Using dimensions: ${width}x${height} pixels`);
        this.logger.debug(`Running command: ${command}`);
      }
      
      try {
        const { stdout, stderr } = await execPromise(command, { timeout: 60000 });
        
        if (stdout && !this.silent) this.logger.log(`Command output: ${stdout}`);
        if (stderr && !this.silent) this.logger.error(`Command error: ${stderr}`);
        
        // Check if the output file was created
        try {
          await fs.access(outputFile);
          if (!this.silent) {
            this.logger.log(`Successfully converted to: ${outputFile}`);
          }
          return true;
        } catch (accessError) {
          if (!this.silent) {
            this.logger.error(`Output file not found: ${accessError.message}`);
          }
          
          // If this is a Gantt chart and standard approach failed, try the fallback method
          if (isGanttChart) {
            return await this.renderGanttWithFallback(inputContent, outputFile, width, height);
          }
          
          return false;
        }
      } catch (error) {
        if (!this.silent) {
          this.logger.error(`Command execution error: ${error.message}`);
        }
        
        // If this is a Gantt chart and standard approach failed, try the fallback method
        if (isGanttChart) {
          return await this.renderGanttWithFallback(inputContent, outputFile, width, height);
        }
        
        return false;
      }
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error converting to PNG: ${error.message}`);
        
        // Enhanced error logging
        try {
          const inputContent = await fs.readFile(inputFile, 'utf-8');
          this.logger.error(`Input file content that caused error: 
          ------- START OF CONTENT -------
          ${inputContent}
          ------- END OF CONTENT -------`);
        } catch (readError) {
          this.logger.error(`Could not read input file: ${readError.message}`);
        }
        
        if (error.stdout) this.logger.log(`Command output: ${error.stdout}`);
        if (error.stderr) this.logger.error(`Command error: ${error.stderr}`);
      }
      return false;
    }
  }
  
  // Fallback method for rendering Gantt charts if the standard approach fails
  async renderGanttWithFallback(ganttCode, outputFile, width, height) {
    this.logger.log("Using fallback method for Gantt chart rendering");
    
    try {
      // Create a simple HTML file with embedded mermaid
      const tempDir = path.dirname(outputFile);
      const htmlFileName = `${path.basename(outputFile, '.png')}.html`;
      const htmlFilePath = path.join(tempDir, htmlFileName);
      
      // Use a simple but effective HTML content with embedded Gantt chart
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Gantt Chart</title>
  <!-- Load mermaid from CDN to ensure compatibility -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: white;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
    #diagram {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mermaid {
      display: inline-block;
    }
  </style>
</head>
<body>
  <div id="diagram">
    <div class="mermaid">
${ganttCode}
    </div>
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      gantt: {
        axisFormat: '%Y-%m-%d',
        fontSize: 14
      }
    });
  </script>
</body>
</html>`;
      
      await fs.writeFile(htmlFilePath, htmlContent, 'utf8');
      
      // Use puppeteer directly for more control over the rendering
      try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width, height });
        
        // Load the HTML file
        await page.goto(`file://${htmlFilePath}`, { waitUntil: 'networkidle0' });
        
        // Wait for mermaid to render
        await page.waitForSelector('.mermaid svg');
        
        // Wait a bit more to ensure everything is rendered
        await page.waitForTimeout(1000);
        
        // Take screenshot
        await page.screenshot({ path: outputFile, omitBackground: true });
        
        await browser.close();
        
        // Clean up
        await fs.unlink(htmlFilePath).catch(() => {});
        
        this.logger.log(`Successfully generated Gantt chart using fallback method`);
        return true;
      } catch (puppeteerError) {
        this.logger.error(`Puppeteer error: ${puppeteerError.message}`);
        
        // Try with mmdc as a last resort
        try {
          const simpleCommand = `npx mmdc -i "${htmlFilePath}" -o "${outputFile}" -w ${width} -H ${height} --backgroundColor "#ffffff"`;
          
          await execPromise(simpleCommand, { timeout: 60000 });
          await fs.unlink(htmlFilePath).catch(() => {});
          
          this.logger.log(`Successfully generated Gantt chart using mmdc with embedded HTML`);
          return true;
        } catch (finalError) {
          this.logger.error(`All Gantt fallback methods failed: ${finalError.message}`);
          return false;
        }
      }
    } catch (error) {
      this.logger.error(`Gantt fallback method failed: ${error.message}`);
      return false;
    }
  }

  async convertMermaidToImage(mermaidCode, options = {}) {
    try {
      // Generate a cache key based on mermaid syntax and options
      const cacheKey = this.cacheHelper.generateCacheKey(mermaidCode, options);
      
      // Check if we have a cached version
      const cachedImage = await this.cacheHelper.getCachedItem(cacheKey);
      if (cachedImage) {
        if (!this.silent) {
          this.logger.log(`Cache hit: Using cached diagram image for ${cacheKey}`);
        }
        return cachedImage;
      }
      
      if (!this.silent) {
        this.logger.log(`Cache miss: Converting diagram ${cacheKey}`);
      }
      
      // Create unique filenames based on content hash
      const tempDir = path.resolve(__dirname, '../../temp');
      // Use .mmd extension which is what mermaid-cli expects for raw mermaid syntax files
      const inputFile = path.join(tempDir, `${cacheKey}.mmd`);
      const outputFile = path.join(tempDir, `${cacheKey}.png`);
      
      // Create directory using the synchronous method for reliability
      ensureDirExistsSync(tempDir);
      
      // Create temporary mermaid file with proper encoding
      await this.createTempMermaidFile(mermaidCode, inputFile);
      
      // Convert to PNG with options
      const success = await this.convertToPng(inputFile, outputFile, options);
      
      if (!success) {
        throw new Error('Failed to convert Mermaid diagram to PNG');
      }
      
      // Read the generated image
      const imageBuffer = await fs.readFile(outputFile);
      
      // Add to cache
      await this.cacheHelper.cacheItem(cacheKey, imageBuffer);
      
      // Clean up temporary files
      await Promise.all([
        fs.unlink(inputFile).catch(() => {}),
        fs.unlink(outputFile).catch(() => {})
      ]);
      
      return imageBuffer;
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error in convertMermaidToImage: ${error.message}`);
        
        // Additional error logging for specific types of errors
        if (error.message.includes('type')) {
          this.logger.error(`This may be a syntax issue with your Mermaid diagram or a plugin compatibility problem.`);
          this.logger.error(`For Gantt charts, try to validate your syntax at https://mermaid.live`);
        }
        if (error.message.includes('Puppeteer')) {
          this.logger.error(`Puppeteer execution error. Check if the diagram syntax is valid.`);
        }
      }
      throw error;
    }
  }
}

module.exports = MermaidService;