const express = require('express');
const convertRoutes = require('./convertRoutes');

const router = express.Router();

router.use('/convert', convertRoutes);

module.exports = router;