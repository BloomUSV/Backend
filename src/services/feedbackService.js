import { ApiError } from '../errors/ApiError.js';
import { Feedback, Resource, User } from '../models/index.js';

export async function listFeedback({ userId, includeAll }) {
  const where = includeAll ? {} : { userId };
  const rows = await Feedback.findAll({
    where,
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  const userIds = [...new Set(rows.map((row) => row.userId))];
  const resourceIds = [...new Set(rows.map((row) => row.resourceId))];
  const users = userIds.length
    ? await User.findAll({
        where: { id: userIds },
        attributes: ['id', 'fullName'],
        raw: true,
      })
    : [];
  const resources = resourceIds.length
    ? await Resource.findAll({
        where: { id: resourceIds },
        attributes: ['id', 'name'],
        raw: true,
      })
    : [];
  const userNames = Object.fromEntries(users.map((u) => [u.id, u.fullName]));
  const resourceNames = Object.fromEntries(
    resources.map((r) => [r.id, r.name]),
  );
  return rows.map((row) => ({
    ...row,
    userName: userNames[row.userId] || null,
    resourceName: resourceNames[row.resourceId] || null,
  }));
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
