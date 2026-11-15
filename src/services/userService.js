import { User } from '../models/index.js';
import { ApiError } from '../errors/ApiError.js';

const USER_ATTRIBUTES = [
  'id',
  'fullName',
  'email',
  'role',
  'isActive',
  'createdAt',
  'updatedAt',
];

export async function listUsers({ page, pageSize }) {
  const normalizedPage = Number(page || 1);
  const normalizedPageSize = Number(pageSize || 20);
  const { count, rows } = await User.findAndCountAll({
    attributes: USER_ATTRIBUTES,
    limit: normalizedPageSize,
    offset: (normalizedPage - 1) * normalizedPageSize,
    order: [['createdAt', 'DESC']],
  });

  return {
    data: rows,
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalItems: count,
      totalPages: Math.ceil(count / normalizedPageSize),
    },
  };
}

export async function updateUserAccess(userId, updates) {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Utilizatorul nu a fost găsit.');
  }

  await user.update(updates);
  return user;
}
