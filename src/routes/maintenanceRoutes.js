import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getMaintenanceBlocks,
  postMaintenanceBlock,
  removeMaintenanceBlock,
} from '../controllers/maintenanceController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.get(
  '/',
  authenticate,
  query('resourceId').optional().isUUID().withMessage('ID-ul resursei trebuie să fie un UUID valid.'),
  validateRequest(400),
  getMaintenanceBlocks,
);

router.post(
  '/',
  authenticate,
  authorize('manager', 'administrator'),
  body('resourceId')
    .isUUID()
    .withMessage('ID-ul resursei trebuie să fie un UUID valid.'),
  body('startsAt')
    .isISO8601()
    .toDate()
    .withMessage('Data de început trebuie să fie validă.'),
  body('endsAt')
    .isISO8601()
    .toDate()
    .withMessage('Data de sfârșit trebuie să fie validă.'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Motivul este obligatoriu.'),
  validateRequest(),
  postMaintenanceBlock,
);

router.delete(
  '/:blockId',
  authenticate,
  authorize('manager', 'administrator'),
  param('blockId').isUUID().withMessage('ID-ul blocului trebuie să fie un UUID valid.'),
  validateRequest(400),
  removeMaintenanceBlock,
);

export default router;