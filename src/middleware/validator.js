const { body, validationResult } = require('express-validator');

const validateMermaidSyntax = (req, res, next) => {
  body('mermaidSyntax')
    .exists()
    .withMessage('Mermaid syntax is required')
    .isString()
    .withMessage('Mermaid syntax must be a string')
    .notEmpty()
    .withMessage('Mermaid syntax cannot be empty')
    .run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  next();
};

module.exports = validateMermaidSyntax;