const express = require('express');
const bodyParser = require('body-parser');
const convertRoutes = require('./routes/convertRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use('/convert', convertRoutes);
app.use(errorHandler);

// Only start the server if this file is run directly, not when imported for tests
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;