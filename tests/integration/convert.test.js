const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const MermaidService = require('../../src/services/mermaidService');
const ConvertController = require('../../src/controllers/convertController');
const validateMermaidSyntax = require('../../src/middleware/validator');
const fileHelper = require('../../src/utils/fileHelper');

// Configure file helper to be silent during tests
fileHelper.configure({ silent: true });

// Create a silent mock logger
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Mock MermaidService
const mockMermaidService = {
  convertMermaidToImage: jest.fn().mockImplementation(mermaidCode => {
    if (!mermaidCode || mermaidCode.includes('invalid syntax')) {
      return Promise.reject(new Error('Invalid Mermaid syntax'));
    }
    return Promise.resolve(Buffer.from('mock image data'));
  })
};

// Create a test app for integration tests
function createTestApp() {
  const app = express();
  app.use(bodyParser.json());

  // Set up route with silent controller
  const controller = new ConvertController(mockMermaidService, { silent: true, logger: mockLogger });
  
  // Create the route
  const router = express.Router();
  router.post('/image', validateMermaidSyntax, controller.convertImage.bind(controller));
  
  app.use('/convert', router);
  
  return app;
}

// Create test app for our tests
const app = createTestApp();

describe('POST /convert/image', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should convert valid Mermaid syntax to an image', async () => {
    const mermaidSyntax = `
      graph TD;
      A-->B;
      A-->C;
      B-->D;
      C-->D;
    `;

    const response = await request(app)
      .post('/convert/image')
      .send({ mermaidSyntax: mermaidSyntax })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/image\/png/);
    expect(mockMermaidService.convertMermaidToImage).toHaveBeenCalledWith(mermaidSyntax);
  });

  it('should return 500 for invalid Mermaid syntax', async () => {
    const invalidMermaidSyntax = `
      invalid syntax
    `;

    const response = await request(app)
      .post('/convert/image')
      .send({ mermaidSyntax: invalidMermaidSyntax })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(500);
    expect(response.body.error).toBeDefined();
  });

  it('should return 400 if Mermaid syntax is missing', async () => {
    const response = await request(app)
      .post('/convert/image')
      .send({})
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
});