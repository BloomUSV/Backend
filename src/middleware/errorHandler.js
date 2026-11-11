import { ApiError } from '../errors/ApiError.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ApiError) {
    const response = { code: error.code, message: error.message };

    if (error.details) {
      response.details = error.details;
    }

    return res.status(error.status).json(response);
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'Corpul cererii nu conține JSON valid.',
    });
  }

  console.error(error);
  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'A apărut o eroare neașteptată.',
  });
}
