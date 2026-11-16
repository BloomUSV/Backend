import { Op } from 'sequelize';
import { ApiError } from '../errors/ApiError.js';
import { MaintenanceBlock, Resource, User } from '../models/index.js';

function toMaintenanceBlockResponse(block) {
  return {
    id: block.id,
    resourceId: block.resourceId,
    startsAt: block.startsAt,
    endsAt: block.endsAt,
    reason: block.reason,
    createdBy: block.createdBy,
    createdAt: block.createdAt,
  };
}

/**
 * Returnează blocurile de mentenanță, opțional filtrate după resursă.
 */
export async function listMaintenanceBlocks({ resourceId } = {}) {
  const where = {};
  if (resourceId) {
    where.resourceId = resourceId;
  }

  const blocks = await MaintenanceBlock.findAll({
    where,
    order: [['startsAt', 'ASC']],
    raw: true,
  });

  return blocks.map(toMaintenanceBlockResponse);
}

/**
 * Creează un bloc de mentenanță. Validată suprapunerea cu blocuri existente
 * prin constrângea de excluziune a bazei de date.
 */
export async function createMaintenanceBlock(input, createdBy) {
  const { resourceId, startsAt, endsAt, reason } = input;

  const resource = await Resource.findOne({
    where: { id: resourceId, isActive: true },
  });

  if (!resource) {
    throw new ApiError(404, 'NOT_FOUND', 'Resursa nu a fost găsită.');
  }

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Intervalul de timp nu este valid.');
  }

  if (startDate >= endDate) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Sfârșitul intervalului trebuie să fi ulterior începutului.');
  }

  const user = createdBy ? await User.findByPk(createdBy) : null;
  if (createdBy && (!user || !user.isActive)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Creatătorul specificat nu este un utilizator activ.');
  }

  const block = await MaintenanceBlock.create({
    resourceId,
    startsAt: startDate,
    endsAt: endDate,
    reason: reason.trim(),
    createdBy: createdBy || null,
  });

  return toMaintenanceBlockResponse(block);
}

/**
 * Șterge un bloc de mentenanță după ID.
 */
export async function deleteMaintenanceBlock(blockId) {
  const deletedCount = await MaintenanceBlock.destroy({
    where: { id: blockId },
  });

  if (deletedCount === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Blocul de mentenanță nu a fost găsit.');
  }

  return { id: blockId };
}