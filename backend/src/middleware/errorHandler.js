// src/middleware/errorHandler.js
//
// CENTRALIZED ERROR HANDLING:
// Instead of try/catch blocks scattered everywhere with duplicated
// res.status(500).json(...) logic, route handlers can just `throw` a
// custom error (or use `next(err)`), and this ONE handler — registered
// last in the Express app — catches everything and formats a consistent
// response. This also means a thrown error never leaks a raw stack trace
// or internal detail to the client in production.

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isAppError = true;
  }
}

// Wraps async route handlers so thrown errors / rejected promises
// automatically reach the error middleware instead of crashing the process.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Must be registered LAST, after all routes: app.use(errorHandler)
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isAppError === true;

  if (!isOperational) {
    // Unexpected error — log full detail server-side, hide it from the client
    console.error("[UNEXPECTED ERROR]", err);
  }

  res.status(statusCode).json({
    error: isOperational ? err.message : "Internal server error",
  });
}

// Catches requests to routes that don't exist
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { AppError, asyncHandler, errorHandler, notFoundHandler };
