import { Router } from 'express';
import { param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as notificationService from '../services/notificationService.js';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    res.json(await notificationService.listNotifications(req.auth.sub));
  } catch (error) {
    next(error);
  }
});

router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    res.json(await notificationService.markAllNotificationsRead(req.auth.sub));
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:notificationId/read',
  authenticate,
  param('notificationId').isUUID(),
  validateRequest(400),
  async (req, res, next) => {
    try {
      res.json(
        await notificationService.markNotificationRead(
          req.params.notificationId,
          req.auth.sub,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;
