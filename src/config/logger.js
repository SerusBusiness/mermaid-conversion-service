const isDev = process.env.NODE_ENV === 'development';

// Simple colorized logger for development
const devLogger = {
  log: (message) => console.log(`\x1b[36m[INFO]\x1b[0m ${message}`),
  error: (message) => console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`),
  warn: (message) => console.warn(`\x1b[33m[WARN]\x1b[0m ${message}`),
  debug: (message) => isDev ? console.debug(`\x1b[35m[DEBUG]\x1b[0m ${message}`) : null
};

// Production logger (no colors, less verbose)
const prodLogger = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  debug: () => {} // No debug logs in production
};

// Export appropriate logger based on environment
module.exports = isDev ? devLogger : prodLogger;