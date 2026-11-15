import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { body } from 'express-validator';
import {
  getAuthenticatedUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { rejectUnknownFields } from '../middleware/rejectUnknownFields.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    console.warn('Login rate limit exceeded.');
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Prea multe încercări. Încearcă din nou mai târziu.',
    });
  },
});

const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    console.warn('Registration rate limit exceeded.');
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Prea multe încercări. Încearcă din nou mai târziu.',
    });
  },
});

router.post(
  '/register',
  registerRateLimit,
  rejectUnknownFields(['fullName', 'email', 'password']),
  body('fullName')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ max: 200 })
    .withMessage(
      'Numele este obligatoriu și poate avea maximum 200 de caractere.',
    ),
  body('email')
    .isEmail()
    .isLength({ max: 320 })
    .withMessage(
      'Introdu o adresă de e-mail validă de maximum 320 de caractere.',
    ),
  body('password')
    .isString()
    .isLength({ min: 12, max: 72 })
    .withMessage('Parola trebuie să aibă între 12 și 72 de caractere.')
    .custom((password) => Buffer.byteLength(password, 'utf8') <= 72)
    .withMessage('Parola nu poate depăși 72 de octeți.'),
  validateRequest(),
  registerUser,
);

router.post(
  '/login',
  loginRateLimit,
  rejectUnknownFields(['email', 'password']),
  body('email')
    .isEmail()
    .isLength({ max: 320 })
    .withMessage(
      'Introdu o adresă de e-mail validă de maximum 320 de caractere.',
    ),
  body('password')
    .isString()
    .notEmpty()
    .withMessage('Parola este obligatorie.'),
  validateRequest(),
  loginUser,
);

router.get('/me', authenticate, getAuthenticatedUser);
router.post('/logout', logoutUser);

export default router;
