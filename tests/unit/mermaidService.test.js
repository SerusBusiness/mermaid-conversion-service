const fs = require('fs').promises;
const path = require('path');
const MermaidService = require('../../src/services/mermaidService');
const fileHelper = require('../../src/utils/fileHelper');

// Configure file helper to be silent during tests
fileHelper.configure({ silent: true });

// Mock the fileHelper instead of trying to mock fs directly
jest.mock('../../src/utils/fileHelper', () => {
  const originalModule = jest.requireActual('../../src/utils/fileHelper');
  originalModule.configure({ silent: true });
  return {
    ...originalModule,
    ensureDirExistsSync: jest.fn().mockReturnValue(true),
    ensureDirExists: jest.fn().mockResolvedValue(true),
    createTempFile: jest.fn().mockResolvedValue('/tmp/test.mmd'),
    deleteFile: jest.fn().mockResolvedValue(),
    configure: jest.fn()
  };
}, { virtual: true });

// Now mock fs.promises separately
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue(Buffer.from('mock image data')),
    unlink: jest.fn().mockResolvedValue(),
    access: jest.fn().mockResolvedValue()
  },
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn()
}));

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    if (callback && typeof callback === 'function') {
      callback(null, { stdout: 'success' });
    }
    return { stdout: 'success' };
  })
}));

jest.mock('util', () => ({
  promisify: jest.fn(fn => async (...args) => {
    // Return a successful result from the promisified exec
    return { stdout: 'success', stderr: '' };
  })
}));

describe('MermaidService', () => {
  let mermaidService;

  beforeEach(() => {
    // Create service with silent mode
    mermaidService = new MermaidService({ silent: true });
    jest.clearAllMocks();
  });

  describe('createTempMermaidFile', () => {
    it('should write mermaid code to temp file', async () => {
      const code = 'graph TD; A-->B;';
      const tempFilePath = '/tmp/test.mmd';
      
      await mermaidService.createTempMermaidFile(code, tempFilePath);
      
      expect(fs.writeFile).toHaveBeenCalledWith(tempFilePath, code, 'utf8');
    });
  });

  describe('convertToPng', () => {
    it('should execute mmdc command to convert mermaid to png', async () => {
      const inputFile = '/tmp/test.mmd';
      const outputFile = '/tmp/test.png';
      
      const result = await mermaidService.convertToPng(inputFile, outputFile);
      
      expect(result).toBe(true);
    });
  });

  describe('convertMermaidToImage', () => {
    it('should create temp files, convert, and return image buffer', async () => {
      const mermaidCode = 'graph TD; A-->B;';
      
      // Mock implementation
      mermaidService.createTempMermaidFile = jest.fn().mockResolvedValue();
      mermaidService.convertToPng = jest.fn().mockResolvedValue(true);
      
      const result = await mermaidService.convertMermaidToImage(mermaidCode);
      
      // Check that createTempMermaidFile was called
      expect(mermaidService.createTempMermaidFile).toHaveBeenCalled();
      
      // Check that convertToPng was called
      expect(mermaidService.convertToPng).toHaveBeenCalled();
      
      // Check that readFile was called to get the image buffer
      expect(fs.readFile).toHaveBeenCalled();
      
      // Check that unlink was called twice (for input and output files)
      expect(fs.unlink).toHaveBeenCalledTimes(2);
      
      // Check that the result is a buffer
      expect(result).toEqual(expect.any(Buffer));
    });

    it('should throw an error if conversion fails', async () => {
      const mermaidCode = 'graph TD; A-->B;';
      
      // Mock implementation for failure
      mermaidService.createTempMermaidFile = jest.fn().mockResolvedValue();
      mermaidService.convertToPng = jest.fn().mockResolvedValue(false);
      
      await expect(mermaidService.convertMermaidToImage(mermaidCode))
        .rejects.toThrow('Failed to convert Mermaid diagram to PNG');
    });
  });
});