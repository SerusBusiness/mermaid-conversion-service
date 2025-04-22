const { body, validationResult } = require('express-validator');

const validateMermaidSyntax = (req, res, next) => {
  // Validate required mermaidSyntax field
  body('mermaidSyntax')
    .exists()
    .withMessage('Mermaid syntax is required')
    .isString()
    .withMessage('Mermaid syntax must be a string')
    .notEmpty()
    .withMessage('Mermaid syntax cannot be empty')
    .run(req);
    
  // Optional width parameter (integer, min 100, max 10000)
  body('width')
    .optional()
    .isInt({ min: 100, max: 10000 })
    .withMessage('Width must be an integer between 100 and 10000')
    .run(req);
    
  // Optional height parameter (integer, min 100, max 10000)
  body('height')
    .optional()
    .isInt({ min: 100, max: 10000 })
    .withMessage('Height must be an integer between 100 and 10000')
    .run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  next();
};

module.exports = validateMermaidSyntax;