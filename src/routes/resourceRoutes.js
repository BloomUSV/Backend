import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  deleteResource,
  getArchivedResources,
  getResourceById,
  getResources,
  postResource,
  putResource,
  restoreArchivedResource,
} from '../controllers/resourceController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { rejectUnknownFields } from '../middleware/rejectUnknownFields.js';
import { validateRequest } from '../middleware/validateRequest.js';

const RESOURCE_TYPES = ['equipment', 'robot', 'cluster', 'laboratory', 'room'];
const RESOURCE_STATES = ['available', 'unavailable', 'maintenance'];
const RESOURCE_FIELDS = [
  'name',
  'type',
  'description',
  'location',
  'state',
  'specifications',
  'managerId',
];

const resourceBodyValidation = [
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ max: 200 })
    .withMessage(
      'Numele este obligatoriu și poate avea maximum 200 de caractere.',
    ),
  body('type')
    .isIn(RESOURCE_TYPES)
    .withMessage('Selectează o categorie validă.'),
  body('description')
    .optional()
    .isString()
    .withMessage('Descrierea trebuie să fie text.'),
  body('location')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ max: 300 })
    .withMessage(
      'Locația este obligatorie și poate avea maximum 300 de caractere.',
    ),
  body('state')
    .optional()
    .isIn(RESOURCE_STATES)
    .withMessage('Selectează o stare validă.'),
  body('specifications')
    .optional()
    .isObject()
    .withMessage('Specificațiile trebuie să fie un obiect JSON.'),
  body('managerId')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('ID-ul managerului trebuie să fie un UUID valid.'),
];

const router = Router();

router.get(
  '/archived',
  authenticate,
  authorize('manager'),
  query('search')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Căutarea poate avea maximum 200 de caractere.'),
  query('type').optional().isIn(RESOURCE_TYPES),
  query('state').optional().isIn(RESOURCE_STATES),
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  validateRequest(400),
  getArchivedResources,
);

router.get(
  '/',
  authenticate,
  query('search')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Căutarea poate avea maximum 200 de caractere.'),
  query('type').optional().isIn(RESOURCE_TYPES),
  query('state').optional().isIn(RESOURCE_STATES),
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('availableFrom').optional().isISO8601(),
  query('availableTo').optional().isISO8601(),
  query('availableTo')
    .optional()
    .custom((availableTo, { req }) => {
      const { availableFrom } = req.query;

      if (!availableFrom) {
        throw new Error(
          'Completează împreună începutul și sfârșitul intervalului.',
        );
      }

      if (new Date(availableFrom) >= new Date(availableTo)) {
        throw new Error(
          'Sfârșitul intervalului trebuie să fie ulterior începutului.',
        );
      }

      return true;
    }),
  query('availableFrom')
    .optional()
    .custom((availableFrom, { req }) => {
      if (!req.query.availableTo) {
        throw new Error(
          'Completează împreună începutul și sfârșitul intervalului.',
        );
      }

      return true;
    }),
  validateRequest(400),
  getResources,
);

router.get(
  '/:resourceId',
  authenticate,
  param('resourceId').isUUID().withMessage('Resource ID must be a valid UUID.'),
  validateRequest(400),
  getResourceById,
);

router.post(
  '/',
  authenticate,
  authorize('manager'),
  rejectUnknownFields(RESOURCE_FIELDS),
  resourceBodyValidation,
  validateRequest(),
  postResource,
);

router.put(
  '/:resourceId',
  authenticate,
  authorize('manager'),
  param('resourceId').isUUID().withMessage('Resource ID must be a valid UUID.'),
  rejectUnknownFields(RESOURCE_FIELDS),
  resourceBodyValidation,
  validateRequest(),
  putResource,
);

router.delete(
  '/:resourceId',
  authenticate,
  authorize('manager'),
  param('resourceId').isUUID().withMessage('Resource ID must be a valid UUID.'),
  validateRequest(400),
  deleteResource,
);

router.post(
  '/:resourceId/restore',
  authenticate,
  authorize('manager'),
  param('resourceId').isUUID().withMessage('Resource ID must be a valid UUID.'),
  validateRequest(400),
  restoreArchivedResource,
);

export default router;
