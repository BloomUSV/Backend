import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as reservationService from '../services/reservationService.js';

const router = Router();

router.get(
  '/',
  authenticate,
  query('scope').optional().isIn(['own', 'all']),
  validateRequest(400),
  async (req, res, next) => {
    try {
      const canAll = req.auth.role !== 'user';
      const scope = req.query.scope === 'all' && canAll ? 'all' : 'own';
      res.json(
        await reservationService.listReservations({
          userId: req.auth.sub,
          scope,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/',
  authenticate,
  authorize('user'),
  body('resourceId').isUUID(),
  body('startsAt').isISO8601().toDate(),
  body('endsAt').isISO8601().toDate(),
  body('purpose').optional().isString(),
  body('teamName').optional({ nullable: true }).isString(),
  body('userId').optional().isUUID(),
  validateRequest(),
  async (req, res, next) => {
    try {
      const result = await reservationService.createReservation(
        req.body,
        req.auth,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/:reservationId',
  authenticate,
  authorize('user'),
  param('reservationId').isUUID(),
  body('startsAt').optional().isISO8601().toDate(),
  body('endsAt').optional().isISO8601().toDate(),
  body('purpose').optional().isString(),
  body('teamName').optional({ nullable: true }).isString(),
  validateRequest(),
  async (req, res, next) => {
    try {
      res.json(
        await reservationService.updateReservation(
          req.params.reservationId,
          req.body,
          req.auth,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:reservationId/cancel',
  authenticate,
  authorize('user', 'manager'),
  param('reservationId').isUUID(),
  validateRequest(400),
  async (req, res, next) => {
    try {
      res.json(
        await reservationService.cancelReservation(
          req.params.reservationId,
          req.auth,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/:reservationId/review',
  authenticate,
  authorize('manager'),
  param('reservationId').isUUID(),
  body('status').isIn(['confirmed', 'rejected']),
  validateRequest(),
  async (req, res, next) => {
    try {
      res.json(
        await reservationService.reviewReservation(
          req.params.reservationId,
          req.body.status,
          req.auth,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;
