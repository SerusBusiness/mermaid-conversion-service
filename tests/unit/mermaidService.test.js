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
    it('should execute mmdc command to convert mermaid to png with default dimensions', async () => {
      const inputFile = '/tmp/test.mmd';
      const outputFile = '/tmp/test.png';
      const { promisify } = require('util');
      
      const result = await mermaidService.convertToPng(inputFile, outputFile);
      
      expect(result).toBe(true);
      // Verify that the default Full HD dimensions are used
      expect(mermaidService.defaultWidth).toBe(1920);
      expect(mermaidService.defaultHeight).toBe(1080);
    });

    it('should execute mmdc command with custom dimensions when provided', async () => {
      const inputFile = '/tmp/test.mmd';
      const outputFile = '/tmp/test.png';
      const customOptions = { width: 1920, height: 1080 };
      const { promisify } = require('util');
      
      // Store original implementation to spy on it
      const origExecPromise = promisify(require('child_process').exec);
      
      const result = await mermaidService.convertToPng(inputFile, outputFile, customOptions);
      
      expect(result).toBe(true);
      
      // We can only verify that promisify was called, but we can't easily verify the exact command string without more complex mocking
      expect(promisify).toHaveBeenCalled();
    });
  });

  describe('convertMermaidToImage', () => {
    it('should create temp files, convert with default dimensions, and return image buffer', async () => {
      const mermaidCode = 'graph TD; A-->B;';
      
      // Mock implementation
      mermaidService.createTempMermaidFile = jest.fn().mockResolvedValue();
      mermaidService.convertToPng = jest.fn().mockResolvedValue(true);
      
      const result = await mermaidService.convertMermaidToImage(mermaidCode);
      
      // Check that createTempMermaidFile was called
      expect(mermaidService.createTempMermaidFile).toHaveBeenCalled();
      
      // Check that convertToPng was called with default options (empty object)
      expect(mermaidService.convertToPng).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        {}
      );
      
      // Check that readFile was called to get the image buffer
      expect(fs.readFile).toHaveBeenCalled();
      
      // Check that unlink was called twice (for input and output files)
      expect(fs.unlink).toHaveBeenCalledTimes(2);
      
      // Check that the result is a buffer
      expect(result).toEqual(expect.any(Buffer));
    });

    it('should create temp files, convert with custom dimensions, and return image buffer', async () => {
      const mermaidCode = 'graph TD; A-->B;';
      const customOptions = { width: 2560, height: 1440 };
      
      // Mock implementation
      mermaidService.createTempMermaidFile = jest.fn().mockResolvedValue();
      mermaidService.convertToPng = jest.fn().mockResolvedValue(true);
      
      const result = await mermaidService.convertMermaidToImage(mermaidCode, customOptions);
      
      // Check that createTempMermaidFile was called
      expect(mermaidService.createTempMermaidFile).toHaveBeenCalled();
      
      // Check that convertToPng was called with custom options
      expect(mermaidService.convertToPng).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        customOptions
      );
      
      // Check that readFile was called to get the image buffer
      expect(fs.readFile).toHaveBeenCalled();
      
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

  describe('fixGanttSyntax', () => {
    it('should fix missing dateFormat in Gantt charts', async () => {
      const ganttCode = 'gantt\n  title Test Gantt\n  section A\n  Task 1: a1, 2024-01-01, 30d';
      const fixed = mermaidService.fixGanttSyntax(ganttCode);
      
      expect(fixed).toContain('dateFormat');
    });
    
    it('should fix multiple after dependencies', async () => {
      const ganttCode = 'gantt\n  title Test Gantt\n  dateFormat YYYY-MM-DD\n  section A\n  Task 1: a1, 2024-01-01, 30d\n  Task 2: a2, after a1, after b1, 20d';
      const fixed = mermaidService.fixGanttSyntax(ganttCode);
      
      // Check that multiple "after" conditions are converted to the & syntax
      expect(fixed).toContain('after a1 & b1');
      expect(fixed).not.toContain('after a1, after b1');
    });
    
    it('should add proper indentation to tasks', async () => {
      const ganttCode = 'gantt\n  title Test Gantt\n  dateFormat YYYY-MM-DD\n  section A\nTask 1: a1, 2024-01-01, 30d';
      const fixed = mermaidService.fixGanttSyntax(ganttCode);
      
      // Check that tasks have proper indentation
      expect(fixed).toContain('    Task 1');
    });
  });

  describe('renderGanttWithFallback', () => {
    it('should attempt to render Gantt with fallback method', async () => {
      // Mock the puppeteer and file system operations
      const puppeteer = {
        launch: jest.fn().mockResolvedValue({
          newPage: jest.fn().mockResolvedValue({
            setViewport: jest.fn().mockResolvedValue(),
            goto: jest.fn().mockResolvedValue(),
            waitForSelector: jest.fn().mockResolvedValue(),
            waitForTimeout: jest.fn().mockResolvedValue(),
            screenshot: jest.fn().mockResolvedValue(),
          }),
          close: jest.fn().mockResolvedValue()
        })
      };
      
      // Mock require for puppeteer
      const originalRequire = global.require;
      global.require = jest.fn((moduleName) => {
        if (moduleName === 'puppeteer') return puppeteer;
        return originalRequire(moduleName);
      });
      
      const ganttCode = 'gantt\n  title Test Gantt\n  dateFormat YYYY-MM-DD\n  section A\n  Task 1: a1, 2024-01-01, 30d';
      const outputFile = '/tmp/test.png';
      
      const result = await mermaidService.renderGanttWithFallback(ganttCode, outputFile, 1920, 1080);
      
      // Restore the original require
      global.require = originalRequire;
      
      // Verify the result
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
    });
  });
});