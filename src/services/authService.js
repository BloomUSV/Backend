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

function escapeLikeWildcards(value) {
  return value.replace(/[\\%_]/g, '\\$&');
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
    where: { email: { [Op.iLike]: escapeLikeWildcards(email.trim()) } },
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

export async function register({ fullName, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({
    attributes: ['id'],
    where: {
      email: { [Op.iLike]: escapeLikeWildcards(normalizedEmail) },
    },
  });

  if (existingUser) {
    throw new ApiError(
      409,
      'EMAIL_IN_USE',
      'Adresa de e-mail este deja asociată unui cont.',
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let user;

  try {
    user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'user',
    });
  } catch (error) {
    const isEmailConflict =
      error.name === 'SequelizeUniqueConstraintError' &&
      error.errors?.some(({ path }) => path === 'email');

    if (isEmailConflict) {
      throw new ApiError(
        409,
        'EMAIL_IN_USE',
        'Adresa de e-mail este deja asociată unui cont.',
      );
    }

    throw error;
  }

  return toUserResponse(user);
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
