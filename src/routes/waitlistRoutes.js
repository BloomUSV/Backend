import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as waitlistService from '../services/waitlistService.js';

const router = Router();

router.get('/', authenticate, authorize('user'), async (req, res, next) => {
  try {
    const includeAll =
      req.query.scope === 'all' &&
      ['manager', 'administrator'].includes(req.auth.role);
    res.json(await waitlistService.listWaitlist(req.auth.sub, includeAll));
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  authenticate,
  authorize('user'),
  body('resourceId').isUUID(),
  body('desiredStart').isISO8601().toDate(),
  body('desiredEnd').isISO8601().toDate(),
  body('requirements').optional().isObject(),
  validateRequest(),
  async (req, res, next) => {
    try {
      res
        .status(201)
        .json(
          await waitlistService.createWaitlistEntry(req.body, req.auth.sub),
        );
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/:entryId',
  authenticate,
  authorize('user'),
  param('entryId').isUUID(),
  validateRequest(400),
  async (req, res, next) => {
    try {
      res.json(
        await waitlistService.removeWaitlistEntry(req.params.entryId, req.auth),
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;
