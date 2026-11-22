import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as feedbackService from '../services/feedbackService.js';

const router = Router();

router.get('/', authenticate, authorize('user'), async (req, res, next) => {
  try {
    const includeAll =
      req.query.scope === 'all' &&
      ['manager', 'administrator'].includes(req.auth.role);
    res.json(
      await feedbackService.listFeedback({
        userId: req.auth.sub,
        includeAll,
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  authenticate,
  authorize('user'),
  body('resourceId').isUUID(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('message').isString().trim().notEmpty().isLength({ max: 5000 }),
  validateRequest(),
  async (req, res, next) => {
    try {
      res
        .status(201)
        .json(await feedbackService.createFeedback(req.body, req.auth.sub));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
