import { ApiError } from '../errors/ApiError.js';
import { Feedback, Resource } from '../models/index.js';

export async function listFeedback({ userId, includeAll }) {
  const where = includeAll ? {} : { userId };
  return Feedback.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });
}

export async function createFeedback(input, userId) {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Evaluarea trebuie să fie între 1 și 5.',
    );
  }
  if (!input.message?.trim()) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Mesajul este obligatoriu.');
  }
  const resource = await Resource.findOne({
    where: { id: input.resourceId, isActive: true },
  });
  if (!resource) {
    throw new ApiError(404, 'NOT_FOUND', 'Resursa nu a fost găsită.');
  }
  return Feedback.create({
    userId,
    resourceId: input.resourceId,
    rating,
    message: input.message.trim(),
  });
}
