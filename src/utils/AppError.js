class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = true; // Hamari apni expected error hai
    }
}
  
module.exports = AppError;