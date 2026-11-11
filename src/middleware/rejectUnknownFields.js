import { ApiError } from '../errors/ApiError.js';

export function rejectUnknownFields(allowedFields) {
  return (req, res, next) => {
    const unknownFields = Object.keys(req.body ?? {}).filter(
      (field) => !allowedFields.includes(field),
    );

    if (unknownFields.length > 0) {
      return next(
        new ApiError(
          422,
          'VALIDATION_ERROR',
          'Corpul cererii conține câmpuri neacceptate.',
          unknownFields.map((field) => ({
            field,
            message: 'Câmpul nu este acceptat.',
          })),
        ),
      );
    }

    return next();
  };
}
