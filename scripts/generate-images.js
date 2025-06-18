const fs = require('fs').promises;
const path = require('path');
const MermaidService = require('../src/services/mermaidService');
const { ensureDirExistsSync } = require('../src/utils/fileHelper');

/**
 * Script to generate PNG images from all .mmd files in the inputs directory
 * Usage: node scripts/generate-images.js [--input <path>] [--output <path>] [options]
 */

// Function to get dynamic paths with fallbacks
function getDynamicPaths() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let inputDir = null;
  let outputDir = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' || args[i] === '-i') {
      inputDir = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (args[i] === '--output' || args[i] === '-o') {
      outputDir = args[i + 1];
      i++; // Skip next argument as it's the value
    }
  }
  
  // Use environment variables as fallback
  inputDir = inputDir || process.env.MERMAID_INPUT_DIR;
  outputDir = outputDir || process.env.MERMAID_OUTPUT_DIR;
  
  // Use default paths relative to the project root if not specified
  const projectRoot = path.resolve(__dirname, '..');
  inputDir = inputDir ? path.resolve(inputDir) : path.resolve(projectRoot, 'inputs');
  outputDir = outputDir ? path.resolve(outputDir) : path.resolve(projectRoot, 'outputs');
  
  return { inputDir, outputDir };
}

async function generateImagesFromInputs() {
  const { inputDir, outputDir } = getDynamicPaths();
  
  console.log('🚀 Starting Mermaid diagram generation...');
  console.log(`📁 Input directory: ${inputDir}`);
  console.log(`📁 Output directory: ${outputDir}`);
  
  try {
    // Check if input directory exists
    try {
      await fs.access(inputDir);
    } catch (error) {
      console.error(`❌ Input directory does not exist: ${inputDir}`);
      console.log('💡 You can specify a custom input directory with --input <path>');
      console.log('💡 Or set the MERMAID_INPUT_DIR environment variable');
      process.exit(1);
    }
    
    // Ensure output directory exists
    ensureDirExistsSync(outputDir);
    
    // Initialize Mermaid service
    const mermaidService = new MermaidService({
      silent: false,
      maxCacheSize: 50,
      cacheTTL: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Read all files from inputs directory
    const files = await fs.readdir(inputDir);
    const mmdFiles = files.filter(file => file.endsWith('.mmd'));
    
    if (mmdFiles.length === 0) {
      console.log(`❌ No .mmd files found in inputs directory: ${inputDir}`);
      return;
    }
    
    console.log(`📊 Found ${mmdFiles.length} Mermaid diagram files:`);
    mmdFiles.forEach(file => console.log(`   - ${file}`));
    console.log('');
    
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    
    // Process each .mmd file
    for (const mmdFile of mmdFiles) {
      const inputFilePath = path.join(inputDir, mmdFile);
      const outputFileName = path.basename(mmdFile, '.mmd') + '.png';
      const outputFilePath = path.join(outputDir, outputFileName);
      
      console.log(`🔄 Processing: ${mmdFile}`);
      
      try {
        // Read the mermaid content
        const mermaidContent = await fs.readFile(inputFilePath, 'utf-8');
        
        // Convert to PNG using the mermaid service
        const imageBuffer = await mermaidService.convertMermaidToImage(mermaidContent, {
          // Use high quality settings for batch generation
          width: 2560,  // High resolution width
          height: 1440, // High resolution height
          scaleFactor: 2.5 // High quality scale factor
        });
        
        // Write the PNG file
        await fs.writeFile(outputFilePath, imageBuffer);
        
        console.log(`✅ Successfully generated: ${outputFileName}`);
        successCount++;
        results.push({
          input: mmdFile,
          output: outputFileName,
          status: 'success',
          size: imageBuffer.length
        });
        
      } catch (error) {
        console.error(`❌ Failed to process ${mmdFile}: ${error.message}`);
        errorCount++;
        results.push({
          input: mmdFile,
          output: outputFileName,
          status: 'error',
          error: error.message
        });
      }
    }
    
    // Summary
    console.log('\n📋 Generation Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📊 Total: ${mmdFiles.length}`);
    
    if (successCount > 0) {
      console.log('\n🎉 Successfully generated images:');
      results
        .filter(r => r.status === 'success')
        .forEach(r => {
          const sizeInKB = Math.round(r.size / 1024);
          console.log(`   - ${r.output} (${sizeInKB} KB)`);
        });
    }
    
    if (errorCount > 0) {
      console.log('\n⚠️  Failed to generate:');
      results
        .filter(r => r.status === 'error')
        .forEach(r => {
          console.log(`   - ${r.input}: ${r.error}`);
        });
    }
    
    // Generate a summary report
    const reportPath = path.join(outputDir, 'generation-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      inputDirectory: inputDir,
      outputDirectory: outputDir,
      totalFiles: mmdFiles.length,
      successCount,
      errorCount,
      results
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: generation-report.json`);
    
    if (errorCount === 0) {
      console.log('\n🎊 All diagrams generated successfully!');
    } else if (successCount > 0) {
      console.log('\n⚠️  Some diagrams generated with errors. Check the report for details.');
    } else {
      console.log('\n💥 No diagrams were generated successfully.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Script execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Additional utility functions
async function generateSingleImage(inputFile, outputFile, options = {}) {
  const mermaidService = new MermaidService({ silent: false });
  
  try {
    const mermaidContent = await fs.readFile(inputFile, 'utf-8');
    const imageBuffer = await mermaidService.convertMermaidToImage(mermaidContent, options);
    await fs.writeFile(outputFile, imageBuffer);
    console.log(`✅ Generated: ${outputFile}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to generate ${outputFile}:`, error.message);
    return false;
  }
}

async function cleanOutputDirectory() {
  const { outputDir } = getDynamicPaths();
  
  try {
    // Check if output directory exists
    try {
      await fs.access(outputDir);
    } catch (error) {
      console.log(`🧹 Output directory does not exist: ${outputDir}`);
      return;
    }
    
    const files = await fs.readdir(outputDir);
    const pngFiles = files.filter(file => file.endsWith('.png') || file.endsWith('.json'));
    
    if (pngFiles.length === 0) {
      console.log('🧹 Output directory is already clean');
      return;
    }
    
    console.log(`🧹 Cleaning ${pngFiles.length} files from output directory...`);
    
    for (const file of pngFiles) {
      await fs.unlink(path.join(outputDir, file));
      console.log(`   Deleted: ${file}`);
    }
    
    console.log('✅ Output directory cleaned');
  } catch (error) {
    console.error('❌ Failed to clean output directory:', error.message);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📊 Mermaid Diagram Generator

Usage:
  node scripts/generate-images.js [options]

Options:
  --input, -i <path>   Input directory containing .mmd files 
                       (default: ./inputs, env: MERMAID_INPUT_DIR)
  --output, -o <path>  Output directory for generated PNG files
                       (default: ./outputs, env: MERMAID_OUTPUT_DIR)
  --clean, -c          Clean output directory before generation
  --help, -h           Show this help message

Environment Variables:
  MERMAID_INPUT_DIR    Default input directory path
  MERMAID_OUTPUT_DIR   Default output directory path

Examples:
  node scripts/generate-images.js                                    # Use default directories
  node scripts/generate-images.js --input ./my-diagrams             # Custom input directory
  node scripts/generate-images.js --output ./generated-images       # Custom output directory
  node scripts/generate-images.js -i ./diagrams -o ./images         # Both custom directories
  node scripts/generate-images.js --clean                           # Clean and generate
  
  # Using environment variables
  MERMAID_INPUT_DIR=./my-input MERMAID_OUTPUT_DIR=./my-output node scripts/generate-images.js
`);
  process.exit(0);
}

// Main execution
async function main() {
  const { inputDir, outputDir } = getDynamicPaths();
  
  // Display configuration
  console.log('⚙️  Configuration:');
  console.log(`   📂 Input Directory: ${inputDir}`);
  console.log(`   📂 Output Directory: ${outputDir}`);
  console.log('');
  
  if (args.includes('--clean') || args.includes('-c')) {
    await cleanOutputDirectory();
    console.log('');
  }
  
  await generateImagesFromInputs();
}

// Export functions for potential use as a module
module.exports = {
  generateImagesFromInputs,
  generateSingleImage,
  cleanOutputDirectory,
  getDynamicPaths
};

// Run the script if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}