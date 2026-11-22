import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as ruleService from '../services/ruleService.js';

const router = Router();

router.get(
  '/',
  authenticate,
  query('resourceId').optional().isUUID(),
  validateRequest(400),
  async (req, res, next) => {
    try {
      res.json(await ruleService.listRules(req.query.resourceId));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/',
  authenticate,
  authorize('administrator'),
  body('resourceId').isUUID(),
  body('title').isString().trim().notEmpty().isLength({ max: 200 }),
  body('content').isString().trim().notEmpty().isLength({ max: 10000 }),
  validateRequest(),
  async (req, res, next) => {
    try {
      res.status(201).json(await ruleService.createRule(req.body));
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/:ruleId',
  authenticate,
  authorize('administrator'),
  param('ruleId').isUUID(),
  body('title').isString().trim().notEmpty().isLength({ max: 200 }),
  body('content').isString().trim().notEmpty().isLength({ max: 10000 }),
  validateRequest(),
  async (req, res, next) => {
    try {
      res.json(await ruleService.updateRule(req.params.ruleId, req.body));
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/:ruleId',
  authenticate,
  authorize('administrator'),
  param('ruleId').isUUID(),
  validateRequest(400),
  async (req, res, next) => {
    try {
      await ruleService.deleteRule(req.params.ruleId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
