import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User } from '../models/index.js';
import { ApiError } from '../errors/ApiError.js';

function toUserResponse(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function login(email, password) {
  const user = await User.unscoped().findOne({
    attributes: [
      'id',
      'fullName',
      'email',
      'passwordHash',
      'role',
      'isActive',
      'createdAt',
      'updatedAt',
    ],
    where: { email: { [Op.iLike]: email.trim() } },
  });

  if (
    !user ||
    !user.isActive ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    throw new ApiError(
      401,
      'UNAUTHORIZED',
      'Adresa de e-mail sau parola sunt incorecte.',
    );
  }

  const accessToken = jwt.sign({ role: user.role }, process.env.JWT_SECRET, {
    subject: user.id,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  return {
    accessToken,
    user: toUserResponse(user),
  };
}

export async function getCurrentUser(userId) {
  const user = await User.findByPk(userId);

  if (!user || !user.isActive) {
    throw new ApiError(
      401,
      'UNAUTHORIZED',
      'Sesiunea a expirat. Autentifică-te din nou.',
    );
  }

  return toUserResponse(user);
}
