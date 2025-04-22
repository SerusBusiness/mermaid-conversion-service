class MermaidService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.silent = options.silent || false;
  }

  async createTempMermaidFile(code, tempFilePath) {
    const fs = require('fs').promises;
    await fs.writeFile(tempFilePath, code, 'utf8');
    if (!this.silent) {
      this.logger.log(`Created temporary mermaid file: ${tempFilePath}`);
    }
  }

  async convertToPng(inputFile, outputFile) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execPromise = promisify(exec);

    try {
      if (!this.silent) {
        this.logger.log(`Converting ${inputFile} to ${outputFile}...`);
        this.logger.log(`Running command: npx mmdc -i "${inputFile}" -o "${outputFile}" -w 1920 -H 1080`);
      }
      
      const command = `npx mmdc -i "${inputFile}" -o "${outputFile}" -w 1920 -H 1080`;
      const { stdout, stderr } = await execPromise(command);
      
      if (stdout && !this.silent) this.logger.log(`Command output: ${stdout}`);
      if (stderr && !this.silent) this.logger.error(`Command error: ${stderr}`);

      if (!this.silent) {
        this.logger.log(`Successfully converted to: ${outputFile}`);
      }
      return true;
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error converting to PNG: ${error.message}`);
        if (error.stdout) this.logger.log(`Command output: ${error.stdout}`);
        if (error.stderr) this.logger.error(`Command error: ${error.stderr}`);
      }
      return false;
    }
  }

  async convertMermaidToImage(mermaidCode) {
    const path = require('path');
    const fs = require('fs').promises;
    const crypto = require('crypto');
    const { ensureDirExistsSync } = require('../utils/fileHelper');
    
    // Create unique filenames based on content hash
    const hash = crypto.createHash('md5').update(mermaidCode).digest('hex');
    const tempDir = path.resolve(__dirname, '../../temp');
    const inputFile = path.join(tempDir, `${hash}.mmd`);
    const outputFile = path.join(tempDir, `${hash}.png`);
    
    try {
      // Create directory using the synchronous method for reliability
      ensureDirExistsSync(tempDir);
      
      // Create temporary mermaid file
      await this.createTempMermaidFile(mermaidCode, inputFile);
      
      // Convert to PNG
      const success = await this.convertToPng(inputFile, outputFile);
      
      if (!success) {
        throw new Error('Failed to convert Mermaid diagram to PNG');
      }
      
      // Read the generated image
      const imageBuffer = await fs.readFile(outputFile);
      
      // Clean up temporary files
      await Promise.all([
        fs.unlink(inputFile).catch(() => {}),
        fs.unlink(outputFile).catch(() => {})
      ]);
      
      return imageBuffer;
    } catch (error) {
      if (!this.silent) {
        this.logger.error(`Error in convertMermaidToImage: ${error.message}`);
      }
      throw error;
    }
  }
}

module.exports = MermaidService;