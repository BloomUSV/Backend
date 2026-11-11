import { validationResult } from 'express-validator';
import { ApiError } from '../errors/ApiError.js';

export function validateRequest(status = 422) {
  return (req, res, next) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      return next();
    }

    const details = errors.array().map(({ path, msg }) => ({
      field: path,
      message: msg,
    }));
    const isBadRequest = status === 400;

    return next(
      new ApiError(
        status,
        isBadRequest ? 'BAD_REQUEST' : 'VALIDATION_ERROR',
        isBadRequest
          ? 'Parametrii cererii nu sunt valizi.'
          : 'Una sau mai multe valori nu sunt valide.',
        isBadRequest ? undefined : details,
      ),
    );
  };
}
