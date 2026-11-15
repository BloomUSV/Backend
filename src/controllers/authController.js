import { getCurrentUser, login, register } from '../services/authService.js';
import { AUTH_COOKIE_NAME, authCookieOptions } from '../middleware/auth.js';

export async function registerUser(req, res, next) {
  try {
    const user = await register(req.body);
    return res.status(201).json({ user });
  } catch (error) {
    return next(error);
  }
}

export async function loginUser(req, res, next) {
  try {
    const result = await login(req.body.email.trim(), req.body.password);
    res.cookie(AUTH_COOKIE_NAME, result.accessToken, authCookieOptions);
    return res.status(200).json({ user: result.user });
  } catch (error) {
    return next(error);
  }
}

export function logoutUser(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions);
  return res.status(204).end();
}

export async function getAuthenticatedUser(req, res, next) {
  try {
    const user = await getCurrentUser(req.auth.sub);
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
}
