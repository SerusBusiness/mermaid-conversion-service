const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  tempDir: process.env.TEMP_DIR || 'temp',
  outputDir: process.env.OUTPUT_DIR || 'temp/images',
  mermaidCommand: process.env.MERMAID_COMMAND || 'npx mmdc',
};

module.exports = config;