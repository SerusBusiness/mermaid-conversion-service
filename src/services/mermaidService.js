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
    
    // Detect if this is a ZenUML diagram
    if (cleaned.trim().startsWith('@startuml') || 
        cleaned.trim().match(/^zenuml\b/) || 
        cleaned.trim().match(/^sequenceDiagram\s+participant/) ||
        cleaned.trim().includes('ZenUML')) {
      cleaned = this.optimizeZenUmlSyntax(cleaned);
    }
    
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
  
  // New method to optimize ZenUML syntax
  optimizeZenUmlSyntax(zenUmlCode) {
    // Don't modify if user has specified configuration params
    if (zenUmlCode.includes('%%{init:')) {
      return zenUmlCode;
    }
    
    // Add initialization header for ZenUML with increased timeout
    const configHeader = `%%{init: {
  'plugin': {
    'zenuml': {
      'timeout': 10000, // Increased from 5000 to 10000
      'preInit': true
    }
  },
  'themeVariables': {
    'fontSize': 14,
    'fontFamily': 'Arial, sans-serif'
  },
  'useMaxWidth': false,
  'highResolution': true
}}%%\n`;
    
    return configHeader + zenUmlCode;
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
    let isTall = false;
    
    // Check flowchart orientation
    if (isFlowchart) {
      isWide = mermaidCode.includes('LR') || mermaidCode.includes('RL');
      isTall = mermaidCode.includes('TD') || mermaidCode.includes('BT');
      
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
      // For very tall TD flowcharts with many nodes, use a taller aspect ratio
      else if (isTall && nodeCount > 20) {
        targetAspectRatio = 9/24; // Extra tall ratio (1:2.67)
        height = Math.max(height, 4320); // Very tall height
        width = height * targetAspectRatio;
      }
      // For moderately tall TD flowcharts
      else if (isTall && nodeCount > 15) {
        targetAspectRatio = 9/16; // Inverse of 16:9 for tall charts
        height = Math.max(height, 2160); // Minimum 4K height
        width = height * targetAspectRatio;
      }
    }
    
    // Check for deep nesting which suggests a tall diagram
    const nestingLevel = this.estimateNestingLevel(mermaidCode);
    if (nestingLevel > 4) {
      targetAspectRatio = Math.max(9/16, 9/(16 + nestingLevel));
      height = Math.max(height, 1080 + (nestingLevel * 200)); // Increase height based on nesting
      width = height * targetAspectRatio;
    }
    
    // Special handling for specific diagrams (Gantt charts are typically wide)
    if (isGantt) {
      // Count timeline entries to determine if it's a tall Gantt chart
      const timelineEntries = lines.filter(line => line.match(/:\s*\w+,/)).length;
      
      if (timelineEntries > 15) {
        // For very tall Gantt charts with many entries
        targetAspectRatio = 2/3; // 2:3 for tall Gantt charts
        height = Math.max(height, 3200); // Taller for many entries
        width = height * targetAspectRatio;
      } else {
        // Default wide Gantt chart
        targetAspectRatio = 3/1; // 3:1 for Gantt charts
        width = Math.max(width, 3200); // Wider default for Gantt
        height = width / targetAspectRatio;
      }
    }
    
    // For sequence diagrams, adjust based on the number of actors and message count
    if (isSequence) {
      const actorCount = lines.filter(line => line.includes('participant') || line.includes('actor')).length;
      const messageCount = lines.filter(line => line.includes('->') || line.includes('-->') || line.includes('->>') || line.includes('-->>') || line.includes('<-') || line.includes('<--')).length;
      
      if (actorCount <= 5 && messageCount > 15) {
        // Tall sequence diagram (few actors but many messages)
        targetAspectRatio = 2/3; // 2:3 ratio for tall sequence diagrams
        height = Math.max(height, 2560); // Taller for many messages
        width = height * targetAspectRatio;
      } else if (actorCount > 5) {
        // Wide sequence diagram (many actors)
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
    
    // For extremely tall diagrams, boost scale factor for better legibility
    if (height > width * 1.5) {
      scaleFactor = Math.min(3.0, scaleFactor + 0.5);
    }
    
    return { width, height, scaleFactor };
  }
  
  // Helper method to estimate nesting level in diagrams
  estimateNestingLevel(mermaidCode) {
    const lines = mermaidCode.split('\n');
    let maxNestingLevel = 0;
    let currentNestingLevel = 0;
    
    for (const line of lines) {
      // Count subgraph/section starts
      if (line.includes('subgraph') || line.includes('section')) {
        currentNestingLevel++;
        maxNestingLevel = Math.max(maxNestingLevel, currentNestingLevel);
      }
      
      // Count subgraph/section ends
      if (line.includes('end') && currentNestingLevel > 0) {
        currentNestingLevel--;
      }
      
      // Count indentation level as a fallback
      const indentationMatch = line.match(/^\s+/);
      if (indentationMatch) {
        const indentationLevel = Math.floor(indentationMatch[0].length / 2);
        maxNestingLevel = Math.max(maxNestingLevel, indentationLevel);
      }
    }
    
    return maxNestingLevel;
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
      
      // Check if it's a special diagram type that may need fallback rendering
      const isGanttChart = inputContent.trim().startsWith('gantt');
      const isZenUML = inputContent.trim().startsWith('@startuml') || 
                       inputContent.trim().match(/^zenuml\b/) || 
                       inputContent.trim().match(/^sequenceDiagram\s+participant/) ||
                       inputContent.trim().includes('ZenUML');
      
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
        if (stderr && !this.silent) {
          this.logger.error(`Command error: ${stderr}`);
          
          // If we get a ZenUML-specific error, try the fallback method
          if (stderr.includes('@zenuml') && isZenUML) {
            return await this.renderZenUmlWithFallback(inputContent, outputFile, width, height, scale);
          }
        }
        
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
          
          // If output file not found, try the appropriate fallback method
          if (isGanttChart) {
            return await this.renderGanttWithFallback(inputContent, outputFile, width, height, scale);
          } else if (isZenUML) {
            return await this.renderZenUmlWithFallback(inputContent, outputFile, width, height, scale);
          }
          
          return false;
        }
      } catch (error) {
        if (!this.silent) {
          this.logger.error(`Command execution error: ${error.message}`);
        }
        
        // If command fails, try the appropriate fallback method
        if (isGanttChart) {
          return await this.renderGanttWithFallback(inputContent, outputFile, width, height, scale);
        } else if (isZenUML) {
          return await this.renderZenUmlWithFallback(inputContent, outputFile, width, height, scale);
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
  
  // Specialized fallback method for rendering ZenUML diagrams
  async renderZenUmlWithFallback(zenumlCode, outputFile, width, height, scale = 2) {
    this.logger.log("Using fallback method for ZenUML diagram rendering");
    
    try {
      // Create a simple HTML file with embedded ZenUML
      const tempDir = path.dirname(outputFile);
      const htmlFileName = `${path.basename(outputFile, '.png')}.html`;
      const htmlFilePath = path.join(tempDir, htmlFileName);
      
      // Use a more robust HTML template for ZenUML with longer timeout
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ZenUML Diagram</title>
  <!-- Load mermaid with ZenUML plugin from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
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
${zenumlCode}
    </div>
  </div>
  <script>
    // Configure mermaid with longer timeout for ZenUML
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'default',
      plugin: {
        loadZenuml: true,
        zenuml: {
          timeout: 10000, // Increased timeout from 7000 to 10000
          preInit: true
        }
      },
      themeVariables: {
        fontSize: 14,
        fontFamily: 'Arial, sans-serif'
      },
      useMaxWidth: false,
      highResolution: true
    });
    
    // Manually render with retry mechanism
    function renderWithRetry(attempts = 5, delay = 1500) { // Increased attempts and initial delay
      if (attempts <= 0) {
        console.error("Failed to render diagram after multiple attempts");
        return;
      }
      
      try {
        mermaid.init(undefined, document.querySelectorAll('.mermaid'));
        console.log("Diagram rendering initiated");
      } catch (error) {
        console.error("Error during render attempt:", error);
        setTimeout(() => renderWithRetry(attempts - 1, delay * 1.5), delay);
      }
    }
    
    // Start rendering after giving the store time to initialize
    setTimeout(() => renderWithRetry(), 3000); // Increased from 2000 to 3000
  </script>
</body>
</html>`;
      
      await fs.writeFile(htmlFilePath, htmlContent, 'utf8');
      
      // Use puppeteer with extended timeout for ZenUML rendering
      try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
          timeout: 90000 // Extended from 60000 to 90000
        });
        
        const page = await browser.newPage();
        await page.setViewport({ 
          width: Math.round(width), 
          height: Math.round(height),
          deviceScaleFactor: scale // Use scale factor for high DPI rendering
        });
        
        // Enable better error logging
        page.on('console', msg => {
          if (msg.type() === 'error' || msg.type() === 'warning') {
            this.logger.debug(`Browser console ${msg.type()}: ${msg.text()}`);
          }
        });
        
        page.on('pageerror', err => {
          this.logger.debug(`Browser page error: ${err.message}`);
        });
        
        // Load the HTML file with extended timeout
        await page.goto(`file://${htmlFilePath}`, { 
          waitUntil: 'networkidle2',
          timeout: 45000 // Increased from 30000 to 45000
        });
        
        // Wait longer for ZenUML to render
        await page.waitForFunction(() => {
          return document.querySelector('.mermaid svg') !== null;
        }, { timeout: 20000 }); // Increased from 15000 to 20000
        
        // Wait extra time to ensure complete rendering
        await page.waitForTimeout(5000); // Increased from 3000 to 5000
        
        // Take screenshot with high quality settings
        await page.screenshot({ 
          path: outputFile, 
          omitBackground: true,
          quality: 100 // Maximum quality for PNG
        });
        
        await browser.close();
        
        // Clean up
        await fs.unlink(htmlFilePath).catch(() => {});
        
        this.logger.log(`Successfully generated ZenUML diagram using fallback method`);
        return true;
      } catch (puppeteerError) {
        this.logger.error(`Puppeteer error with ZenUML: ${puppeteerError.message}`);
        
        // Try with standard mermaid as a last resort
        try {
          // Modify the HTML to use standard sequence diagram syntax if possible
          const fallbackHtml = htmlFilePath.replace('.html', '-fallback.html');
          
          // Try to convert to standard mermaid syntax if possible
          let standardMermaid = zenumlCode;
          if (zenumlCode.includes('@startuml')) {
            standardMermaid = standardMermaid.replace('@startuml', 'sequenceDiagram');
            standardMermaid = standardMermaid.replace('@enduml', '');
          }
          
          const fallbackContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Fallback Diagram</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body { margin: 0; padding: 0; background: white; }
    .mermaid { max-width: 100%; }
  </style>
</head>
<body>
  <div class="mermaid">
${standardMermaid}
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      logLevel: 'fatal',
      securityLevel: 'loose'
    });
  </script>
</body>
</html>`;
          
          await fs.writeFile(fallbackHtml, fallbackContent);
          
          const simpleCommand = `npx mmdc -i "${fallbackHtml}" -o "${outputFile}" -w ${width} -H ${height} --backgroundColor "#ffffff"`;
          
          await execPromise(simpleCommand, { timeout: 60000 });
          
          // Clean up
          await fs.unlink(fallbackHtml).catch(() => {});
          await fs.unlink(htmlFilePath).catch(() => {});
          
          this.logger.log(`Generated diagram using standard mermaid fallback`);
          return true;
        } catch (finalError) {
          this.logger.error(`All ZenUML fallback methods failed: ${finalError.message}`);
          return false;
        }
      }
    } catch (error) {
      this.logger.error(`ZenUML fallback method failed: ${error.message}`);
      return false;
    }
  }
  
  // Specialized fallback method for rendering Gantt diagrams
  async renderGanttWithFallback(ganttCode, outputFile, width, height, scale = 2) {
    this.logger.log("Using fallback method for Gantt chart rendering");
    
    try {
      // Create a simple HTML file with embedded Gantt
      const tempDir = path.dirname(outputFile);
      const htmlFileName = `${path.basename(outputFile, '.png')}.html`;
      const htmlFilePath = path.join(tempDir, htmlFileName);
      
      // Use a more robust HTML template for Gantt with proper configuration
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Gantt Chart</title>
  <!-- Load mermaid from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
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
      width: 100%;
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
    // Configure mermaid with optimal settings for Gantt charts
    mermaid.initialize({
      startOnLoad: true,
      securityLevel: 'loose',
      theme: 'default',
      gantt: {
        titleTopMargin: 25,
        barHeight: 20,
        barGap: 4,
        topPadding: 50,
        sidePadding: 75,
        gridLineStartPadding: 35,
        fontSize: 12
      },
      themeVariables: {
        fontSize: 14,
        fontFamily: 'Arial, sans-serif'
      },
      useMaxWidth: false,
      highResolution: true,
      logLevel: 'error'
    });
  </script>
</body>
</html>`;
      
      await fs.writeFile(htmlFilePath, htmlContent, 'utf8');
      
      // Use puppeteer for rendering
      try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          timeout: 60000
        });
        
        const page = await browser.newPage();
        await page.setViewport({ 
          width: Math.round(width), 
          height: Math.round(height),
          deviceScaleFactor: scale
        });
        
        // Enable better error logging
        page.on('console', msg => {
          if (msg.type() === 'error' || msg.type() === 'warning') {
            this.logger.debug(`Browser console ${msg.type()}: ${msg.text()}`);
          }
        });
        
        // Load the HTML file
        await page.goto(`file://${htmlFilePath}`, { 
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // Wait for Gantt chart to render
        await page.waitForFunction(() => {
          return document.querySelector('.mermaid svg') !== null;
        }, { timeout: 15000 });
        
        // Wait extra time to ensure complete rendering
        await page.waitForTimeout(2000);
        
        // Take screenshot
        await page.screenshot({ 
          path: outputFile, 
          omitBackground: true,
          quality: 100
        });
        
        await browser.close();
        
        // Clean up
        await fs.unlink(htmlFilePath).catch(() => {});
        
        this.logger.log(`Successfully generated Gantt chart using fallback method`);
        return true;
      } catch (puppeteerError) {
        this.logger.error(`Puppeteer error with Gantt chart: ${puppeteerError.message}`);
        
        // Try with CLI as a last resort
        try {
          // Generate a simpler HTML file
          const fallbackHtml = htmlFilePath.replace('.html', '-fallback.html');
          const fallbackContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Fallback Gantt Chart</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body { margin: 0; padding: 0; background: white; }
    .mermaid { max-width: 100%; }
  </style>
</head>
<body>
  <div class="mermaid">
${ganttCode}
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      logLevel: 'fatal',
      securityLevel: 'loose',
      gantt: {
        barHeight: 20,
        barGap: 4,
        topPadding: 50,
        sidePadding: 75
      }
    });
  </script>
</body>
</html>`;
          
          await fs.writeFile(fallbackHtml, fallbackContent);
          
          const simpleCommand = `npx mmdc -i "${fallbackHtml}" -o "${outputFile}" -w ${width} -H ${height} --backgroundColor "#ffffff"`;
          
          await execPromise(simpleCommand, { timeout: 60000 });
          
          // Clean up
          await fs.unlink(fallbackHtml).catch(() => {});
          await fs.unlink(htmlFilePath).catch(() => {});
          
          this.logger.log(`Generated Gantt chart using CLI fallback`);
          return true;
        } catch (finalError) {
          this.logger.error(`All Gantt chart fallback methods failed: ${finalError.message}`);
          return false;
        }
      }
    } catch (error) {
      this.logger.error(`Gantt chart fallback method failed: ${error.message}`);
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