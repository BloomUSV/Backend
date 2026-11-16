import {
  createMaintenanceBlock,
  deleteMaintenanceBlock,
  listMaintenanceBlocks,
} from '../services/maintenanceService.js';

export async function getMaintenanceBlocks(req, res, next) {
  try {
    const blocks = await listMaintenanceBlocks({
      resourceId: req.query.resourceId,
    });
    return res.status(200).json(blocks);
  } catch (error) {
    return next(error);
  }
}

export async function postMaintenanceBlock(req, res, next) {
  try {
    const block = await createMaintenanceBlock(req.body, req.auth?.sub);
    return res.status(201).json(block);
  } catch (error) {
    return next(error);
  }
}

export async function removeMaintenanceBlock(req, res, next) {
  try {
    await deleteMaintenanceBlock(req.params.blockId);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}