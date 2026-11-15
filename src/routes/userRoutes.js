import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { getUsers, updateUser } from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { rejectUnknownFields } from '../middleware/rejectUnknownFields.js';
import { validateRequest } from '../middleware/validateRequest.js';

const USER_ROLES = ['user', 'manager', 'administrator'];
const router = Router();

router.use(authenticate, authorize('administrator'));

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  validateRequest(400),
  getUsers,
);

router.patch(
  '/:userId',
  param('userId').isUUID().withMessage('User ID must be a valid UUID.'),
  rejectUnknownFields(['role', 'isActive']),
  body('role')
    .optional()
    .isIn(USER_ROLES)
    .withMessage('Selectează un rol valid.'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Starea contului trebuie să fie booleană.')
    .toBoolean(),
  body()
    .custom((value) => Object.keys(value).length > 0)
    .withMessage('Completează cel puțin un câmp de modificat.'),
  validateRequest(),
  updateUser,
);

export default router;
