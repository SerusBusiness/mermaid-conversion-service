const express = require('express');
const ConvertController = require('../controllers/convertController');
const MermaidService = require('../services/mermaidService');
const validateMermaidSyntax = require('../middleware/validator');

const router = express.Router();

// Check if we're in a test environment
const isTestEnv = process.env.NODE_ENV === 'test';

// Create service and controller with appropriate logging settings
const mermaidService = new MermaidService({ silent: isTestEnv });
const convertController = new ConvertController(mermaidService, { silent: isTestEnv });

router.post('/image', validateMermaidSyntax, convertController.convertImage.bind(convertController));

module.exports = router;