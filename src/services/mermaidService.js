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
    
    // Default scale factor for high resolution rendering
    this.defaultScaleFactor = 2.0; // Higher value = better quality but larger file size
    
    // Min/max values to prevent extreme resolutions that might cause rendering issues
    this.minWidth = 800;
    this.maxWidth = 8000;
    this.minHeight = 400;
    this.maxHeight = 8000;
    
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
    
    // Add high-resolution configuration for flowcharts
    if (cleaned.trim().startsWith('flowchart')) {
      cleaned = this.optimizeFlowchartSyntax(cleaned);
    }
    
    return cleaned;
  }
  
  // New method to optimize flowcharts for better resolution and wide charts
  optimizeFlowchartSyntax(flowchartCode) {
    // Don't modify if user has specified configuration params
    if (flowchartCode.includes('%%{init:')) {
      return flowchartCode;
    }
    
    // Determine if this is likely a wide flowchart by looking for many nodes on the same level
    const lines = flowchartCode.split('\n');
    let nodeCount = 0;
    let levelIndicators = 0;
    
    // Count nodes and level indicators to estimate flowchart shape
    for (const line of lines) {
      if (line.includes('-->') || line.includes('---')) nodeCount++;
      if (line.includes('TD') || line.includes('LR')) {
        // If wide flowchart (LR) or potentially complex TD flowchart
        levelIndicators = line.includes('LR') ? 2 : 1;
      }
    }
    
    // Determine if this is likely a wide flowchart (more than 10 nodes or explicit LR direction)
    const isWideFlowchart = levelIndicators === 2 || nodeCount > 10;
    
    // Add optimal configuration header based on flowchart type
    const configHeader = `%%{init: {
  'flowchart': {
    'curve': 'basis',
    'diagramPadding': 10,
    'nodeSpacing': ${isWideFlowchart ? 40 : 60},
    'rankSpacing': ${isWideFlowchart ? 60 : 80},
    'padding': 15
  },
  'themeVariables': {
    'fontSize': 14,
    'fontFamily': 'Arial, sans-serif'
  },
  'useMaxWidth': false,
  'highResolution': true,
  'renderOptimize': true
}}%%\n`;
    
    return configHeader + flowchartCode;
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

  // Calculate optimal dimensions based on diagram type and content
  calculateOptimalDimensions(mermaidCode, requestedWidth, requestedHeight) {
    // Start with the requested dimensions or defaults
    let width = requestedWidth || this.defaultWidth;
    let height = requestedHeight || this.defaultHeight;
    
    // Default aspect ratio (16:9)
    let targetAspectRatio = 16/9;
    
    // Identify diagram type
    const isFlowchart = mermaidCode.trim().startsWith('flowchart') || mermaidCode.trim().startsWith('graph');
    const isGantt = mermaidCode.trim().startsWith('gantt');
    const isSequence = mermaidCode.trim().startsWith('sequenceDiagram');
    
    // Estimate diagram complexity by counting nodes and connections
    const lines = mermaidCode.split('\n');
    let nodeCount = 0;
    let connectionCount = 0;
    let isWide = false;
    
    // Check flowchart orientation
    if (isFlowchart) {
      isWide = mermaidCode.includes('LR') || mermaidCode.includes('RL');
      
      // Count nodes and connections
      for (const line of lines) {
        if (line.includes('-->') || line.includes('---')) connectionCount++;
        if (line.match(/\[.*?\]/)) nodeCount++;
        if (line.match(/\(.*?\)/)) nodeCount++;
      }
      
      // For very wide flowcharts with many nodes, use a wider aspect ratio
      if (isWide && nodeCount > 15) {
        targetAspectRatio = 4/1; // 4:1 for very wide charts
        width = Math.max(width, 3840); // Minimum 4K width for complex wide charts
        height = width / targetAspectRatio;
      }
      // For moderately wide flowcharts
      else if (isWide && nodeCount > 8) {
        targetAspectRatio = 3/1; // 3:1 for moderately wide charts
        width = Math.max(width, 2560); // Minimum 2.5K width
        height = width / targetAspectRatio;
      }
      // For TD flowcharts with many nodes, increase height
      else if (!isWide && nodeCount > 15) {
        targetAspectRatio = 9/16; // Inverse of 16:9 for tall charts
        height = Math.max(height, 2160); // Minimum 4K height
        width = height * targetAspectRatio;
      }
    }
    
    // Special handling for specific diagrams (Gantt charts are typically wide)
    if (isGantt) {
      targetAspectRatio = 3/1; // 3:1 for Gantt charts
      width = Math.max(width, 3200); // Wider default for Gantt
      height = width / targetAspectRatio;
    }
    
    // For sequence diagrams, adjust based on the number of actors
    if (isSequence) {
      const actorCount = lines.filter(line => line.includes('participant') || line.includes('actor')).length;
      if (actorCount > 5) {
        targetAspectRatio = 2/1; // 2:1 for sequence diagrams with many actors
        width = Math.max(width, 2560); // Wider for many actors
        height = width / targetAspectRatio;
      }
    }
    
    // Apply min/max constraints
    width = Math.max(this.minWidth, Math.min(this.maxWidth, width));
    height = Math.max(this.minHeight, Math.min(this.maxHeight, height));
    
    // Calculate scale factor based on complexity
    let scaleFactor = this.defaultScaleFactor;
    
    // For very complex diagrams, increase scale factor further
    if (nodeCount > 30 || connectionCount > 40) {
      scaleFactor = 3.0;
    } else if (nodeCount > 15 || connectionCount > 20) {
      scaleFactor = 2.5;
    }
    
    return { width, height, scaleFactor };
  }

  async convertToPng(inputFile, outputFile, options = {}) {
    try {
      // Read input file to determine diagram type and optimize dimensions
      const inputContent = await fs.readFile(inputFile, 'utf-8');
      
      // Use optimal dimensions calculation
      const { width, height, scaleFactor } = this.calculateOptimalDimensions(
        inputContent, 
        options.width, 
        options.height
      );
      
      // Use provided scale factor or the calculated one
      const scale = options.scaleFactor || scaleFactor;
      
      // Reference to config files
      const puppeteerConfigPath = path.resolve(__dirname, '../config/puppeteer-config.json');
      const mermaidConfigPath = path.resolve(__dirname, '../config/mermaid.config.json');
      
      // Check if it's a Gantt chart or specific diagram type
      const isGanttChart = inputContent.trim().startsWith('gantt');
      
      // Build command with optimal dimensions and quality settings
      let command = `npx mmdc -i "${inputFile}" -o "${outputFile}" -w ${width} -H ${height} -p "${puppeteerConfigPath}" -c "${mermaidConfigPath}" --backgroundColor "#ffffff" --scale ${scale}`;
      
      if (!this.silent) {
        this.logger.log(`Converting ${inputFile} to ${outputFile}...`);
        this.logger.log(`Using dimensions: ${width}x${height} pixels with scale factor: ${scale}`);
        this.logger.debug(`Running command: ${command}`);
      }
      
      try {
        const { stdout, stderr } = await execPromise(command, { timeout: 120000 }); // Higher timeout for complex diagrams
        
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
            return await this.renderGanttWithFallback(inputContent, outputFile, width, height, scale);
          }
          
          return false;
        }
      } catch (error) {
        if (!this.silent) {
          this.logger.error(`Command execution error: ${error.message}`);
        }
        
        // If this is a Gantt chart and standard approach failed, try the fallback method
        if (isGanttChart) {
          return await this.renderGanttWithFallback(inputContent, outputFile, width, height, scale);
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
  async renderGanttWithFallback(ganttCode, outputFile, width, height, scale = 2) {
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
      },
      useMaxWidth: false,
      highResolution: true
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
        await page.setViewport({ 
          width: Math.round(width), 
          height: Math.round(height),
          deviceScaleFactor: scale // Use scale factor for high DPI rendering
        });
        
        // Load the HTML file
        await page.goto(`file://${htmlFilePath}`, { waitUntil: 'networkidle0' });
        
        // Wait for mermaid to render
        await page.waitForSelector('.mermaid svg');
        
        // Wait a bit more to ensure everything is rendered
        await page.waitForTimeout(1000);
        
        // Take screenshot with high quality settings
        await page.screenshot({ 
          path: outputFile, 
          omitBackground: true,
          quality: 100 // Maximum quality for PNG
        });
        
        await browser.close();
        
        // Clean up
        await fs.unlink(htmlFilePath).catch(() => {});
        
        this.logger.log(`Successfully generated Gantt chart using fallback method`);
        return true;
      } catch (puppeteerError) {
        this.logger.error(`Puppeteer error: ${puppeteerError.message}`);
        
        // Try with mmdc as a last resort
        try {
          const simpleCommand = `npx mmdc -i "${htmlFilePath}" -o "${outputFile}" -w ${width} -H ${height} --backgroundColor "#ffffff" --scale ${scale}`;
          
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