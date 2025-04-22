class ConvertController {
  constructor(mermaidService, options = {}) {
    this.mermaidService = mermaidService;
    this.logger = options.logger || console;
    this.silent = options.silent || false;
  }

  async convertImage(req, res) {
    try {
      const mermaidCode = req.body.mermaidSyntax;
      // logging the request body for debugging
      if (!this.silent) {
        this.logger.log(`Received request body: ${JSON.stringify(req.body)}`);
      }
      
      if (!mermaidCode) {
        return res.status(400).json({ error: 'Mermaid syntax is required' });
      }

      const imageBuffer = await this.mermaidService.convertMermaidToImage(mermaidCode);
      res.set('Content-Type', 'image/png');
      res.send(imageBuffer);
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error converting image: ${error.message}`);
      }
      res.status(500).json({ error: 'Failed to convert Mermaid syntax to image' });
    }
  }
}

module.exports = ConvertController;