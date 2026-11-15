import jwt from 'jsonwebtoken';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../models/index.js';

export const AUTH_COOKIE_NAME = 'rrm.accessToken';

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api',
};

export async function authenticate(req, res, next) {
  const cookie = req
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  const token = cookie?.slice(AUTH_COOKIE_NAME.length + 1);

  if (!token) {
    return next(
      new ApiError(401, 'UNAUTHORIZED', 'Autentificarea este necesară.'),
    );
  }

  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
  } catch {
    return next(
      new ApiError(
        401,
        'UNAUTHORIZED',
        'Sesiunea a expirat. Autentifică-te din nou.',
      ),
    );
  }

  if (typeof claims === 'string' || typeof claims.sub !== 'string') {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Sesiunea nu este validă.'));
  }

  try {
    const user = await User.findByPk(claims.sub);

    if (!user || !user.isActive) {
      return next(
        new ApiError(
          401,
          'UNAUTHORIZED',
          'Contul nu mai este activ. Autentifică-te din nou.',
        ),
      );
    }

    req.auth = { sub: user.id, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth?.role)) {
      return next(
        new ApiError(
          403,
          'FORBIDDEN',
          'Nu ai permisiunea de a efectua această operațiune.',
        ),
      );
    }

    return next();
  };
}
