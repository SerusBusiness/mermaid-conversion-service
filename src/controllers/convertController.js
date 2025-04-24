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
      
      // Enhanced debugging - log the full request body and dimensions
      if (!this.silent) {
        this.logger.debug(`Received convert image request with dimensions: ${width}x${height}`);
        this.logger.debug(`Request body: ${JSON.stringify({
          mermaidSyntax: mermaidCode ? 
            (mermaidCode.length > 100 ? mermaidCode.substring(0, 100) + '...' : mermaidCode) : null,
          width,
          height
        })}`);
      }
      
      if (!mermaidCode) {
        this.logger.warn('Request missing required mermaidSyntax');
        return res.status(400).json({ error: 'Mermaid syntax is required' });
      }

      const imageBuffer = await this.mermaidService.convertMermaidToImage(mermaidCode, { width, height });
      
      this.logger.log(`Successfully converted Mermaid diagram to PNG (${imageBuffer.length} bytes)`);
      
      res.set('Content-Type', 'image/png');
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
    
    if (syntax.trim().startsWith('graph')) return 'flowchart';
    if (syntax.trim().startsWith('sequenceDiagram')) return 'sequence';
    if (syntax.trim().startsWith('classDiagram')) return 'class';
    if (syntax.trim().startsWith('stateDiagram')) return 'state';
    if (syntax.trim().startsWith('gantt')) return 'gantt';
    if (syntax.trim().startsWith('pie')) return 'pie';
    if (syntax.trim().startsWith('erDiagram')) return 'er';
    if (syntax.trim().startsWith('journey')) return 'journey';
    
    return 'unknown';
  }
}

module.exports = ConvertController;