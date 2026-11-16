import { Router } from 'express';
import { query } from 'express-validator';
import { listCalendarEvents } from '../controllers/calendarController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.get(
  '/events',
  authenticate,
  query('start')
    .isISO8601()
    .toDate()
    .withMessage('Data de început trebuie să fie o dată ISO 8601 validă.'),
  query('end')
    .isISO8601()
    .toDate()
    .withMessage('Data de sfârșit trebuie să fie o dată ISO 8601 validă.'),
  query('end')
    .custom((end, { req }) => {
      const { start } = req.query;
      if (start && new Date(end) <= new Date(start)) {
        throw new Error('Sfârșitul intervalului trebuie să fie ulterior începutului.');
      }
      return true;
    }),
  query('resourceId').optional().isUUID().withMessage('ID-ul resursei trebuie să fie un UUID valid.'),
  validateRequest(400),
  listCalendarEvents,
);

export default router;