const express = require('express');
const convertRoutes = require('./convertRoutes');

const router = express.Router();

// Health check endpoint for Docker healthchecks
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Register convert routes
router.use('/convert', convertRoutes);

module.exports = router;