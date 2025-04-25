const logger = require('../config/logger');

class ConvertController {
  constructor(mermaidService, options = {}) {
    this.mermaidService = mermaidService;
    this.logger = options.logger || logger;
    this.silent = options.silent || false;
  }

  async convertImage(req, res) {
    try {
      const mermaidCode = req.body.mermaidSyntax;
      const width = req.body.width ? parseInt(req.body.width) : undefined;
      const height = req.body.height ? parseInt(req.body.height) : undefined;
      const scaleFactor = req.body.scaleFactor ? parseFloat(req.body.scaleFactor) : undefined;
      
      // Detect potential wide diagrams based on requested dimensions or syntax
      const isWideAspectRatio = width && height && (width / height > 2.5);
      const diagramType = this.getDiagramType(mermaidCode);
      
      // Enhanced debugging - log the full request body and dimensions
      if (!this.silent) {
        this.logger.debug(`Received convert image request with dimensions: ${width}x${height}${scaleFactor ? `, scale: ${scaleFactor}` : ''}`);
        this.logger.debug(`Diagram type detected: ${diagramType}`);
        this.logger.debug(`Is wide aspect ratio: ${isWideAspectRatio ? 'Yes' : 'No'}`);
        this.logger.debug(`Request body: ${JSON.stringify({
          mermaidSyntax: mermaidCode ? 
            (mermaidCode.length > 100 ? mermaidCode.substring(0, 100) + '...' : mermaidCode) : null,
          width,
          height,
          scaleFactor
        })}`);
      }
      
      if (!mermaidCode) {
        this.logger.warn('Request missing required mermaidSyntax');
        return res.status(400).json({ error: 'Mermaid syntax is required' });
      }
      
      // Set default scale factor for wide diagrams if not explicitly provided
      const renderOptions = { 
        width, 
        height,
        scaleFactor: scaleFactor || (isWideAspectRatio ? 2.5 : undefined),
        // Pass through diagram type for optimizations
        diagramType
      };

      const imageBuffer = await this.mermaidService.convertMermaidToImage(mermaidCode, renderOptions);
      
      if (!this.silent) {
        this.logger.log(`Successfully converted ${diagramType} diagram to PNG (${imageBuffer.length} bytes)`);
        if (isWideAspectRatio) {
          this.logger.log(`Used enhanced rendering for wide aspect ratio (${width}x${height})`);
        }
      }
      
      res.set('Content-Type', 'image/png');
      res.set('X-Diagram-Type', diagramType);
      res.set('X-Rendering-Options', JSON.stringify({
        width: renderOptions.width || 'default',
        height: renderOptions.height || 'default',
        scaleFactor: renderOptions.scaleFactor || 'default'
      }));
      res.send(imageBuffer);
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error converting image: ${error.message}`);
        
        // Add more detailed error information
        if (req.body) {
          this.logger.error(`Failed request details: 
          - Diagram type: ${this.getDiagramType(req.body.mermaidSyntax)}
          - Syntax length: ${req.body?.mermaidSyntax?.length || 0} characters
          - Requested dimensions: ${req.body.width || 'default'} x ${req.body.height || 'default'}
          `);
        }
      }
      res.status(500).json({ error: 'Failed to convert Mermaid syntax to image' });
    }
  }
  
  // Helper to identify the diagram type from the syntax
  getDiagramType(syntax) {
    if (!syntax) return 'unknown';
    
    if (syntax.trim().startsWith('flowchart')) return 'flowchart';
    if (syntax.trim().startsWith('graph')) return 'flowchart';
    if (syntax.trim().startsWith('sequenceDiagram')) return 'sequence';
    if (syntax.trim().startsWith('classDiagram')) return 'class';
    if (syntax.trim().startsWith('stateDiagram')) return 'state';
    if (syntax.trim().startsWith('gantt')) return 'gantt';
    if (syntax.trim().startsWith('pie')) return 'pie';
    if (syntax.trim().startsWith('erDiagram')) return 'er';
    if (syntax.trim().startsWith('journey')) return 'journey';
    if (syntax.trim().startsWith('gitGraph')) return 'gitgraph';
    if (syntax.trim().startsWith('mindmap')) return 'mindmap';
    if (syntax.trim().startsWith('timeline')) return 'timeline';
    if (syntax.trim().startsWith('quadrantChart')) return 'quadrant';
    
    return 'unknown';
  }
}

module.exports = ConvertController;