import { Op } from 'sequelize';
import { ApiError } from '../errors/ApiError.js';
import { Notification, Resource, WaitlistEntry } from '../models/index.js';

export async function notifyWaitlistAvailable(resourceId, start, end) {
  const entries = await WaitlistEntry.findAll({
    where: {
      resourceId,
      status: 'waiting',
      desiredStart: { [Op.lt]: end },
      desiredEnd: {
        [Op.gt]: new Date(Math.max(new Date(start).getTime(), Date.now())),
      },
    },
    order: [['createdAt', 'ASC']],
  });
  for (const entry of entries) {
    await entry.update({ status: 'notified' });
    await Notification.create({
      userId: entry.userId,
      message: 'Un interval solicitat la resursă este acum disponibil.',
      type: 'slot_available',
    });
  }
  return entries.length;
}

export async function notifyWaitlistMaintenance(resourceId, start, end) {
  const entries = await WaitlistEntry.findAll({
    where: {
      resourceId,
      status: 'waiting',
      desiredStart: { [Op.lt]: end },
      desiredEnd: { [Op.gt]: start },
    },
  });
  for (const entry of entries) {
    await Notification.create({
      userId: entry.userId,
      message:
        'Intervalul solicitat este temporar indisponibil din cauza unei mentenanțe.',
      type: 'resource_maintenance',
    });
  }
  return entries.length;
}

export async function listWaitlist(userId, includeAll) {
  const where = includeAll ? {} : { userId };
  await WaitlistEntry.update(
    { status: 'expired' },
    {
      where: {
        ...(includeAll ? {} : { userId }),
        status: { [Op.in]: ['waiting', 'notified'] },
        desiredEnd: { [Op.lt]: new Date() },
      },
    },
  );
  const entries = await WaitlistEntry.findAll({
    where,
    order: [['createdAt', 'ASC']],
  });
  const resourceIds = [...new Set(entries.map((entry) => entry.resourceId))];
  let resources = [];
  if (resourceIds.length > 0) {
    resources = await Resource.findAll({
      where: { id: { [Op.in]: resourceIds } },
      attributes: ['id', 'name'],
    });
  }
  const resourceNames = Object.fromEntries(
    resources.map((resource) => [resource.id, resource.name]),
  );
  return entries.map((entry) => {
    const waitingEntries = entries.filter(
      (candidate) =>
        candidate.resourceId === entry.resourceId &&
        candidate.status === 'waiting' &&
        candidate.createdAt <= entry.createdAt,
    );
    const position =
      entry.status === 'waiting'
        ? waitingEntries.findIndex((candidate) => candidate.id === entry.id) + 1
        : null;
    return {
      ...entry.toJSON(),
      resourceName: resourceNames[entry.resourceId] || null,
      position,
    };
  });
}

export async function createWaitlistEntry(input, userId) {
  const start = new Date(input.desiredStart);
  const end = new Date(input.desiredEnd);
  if (
    isNaN(start.getTime()) ||
    isNaN(end.getTime()) ||
    start < new Date() ||
    start >= end
  ) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Alege un interval viitor cu sfârșitul ulterior începutului.',
    );
  }
  const resource = await Resource.findOne({
    where: { id: input.resourceId, isActive: true },
  });
  if (!resource) {
    throw new ApiError(404, 'NOT_FOUND', 'Resursa nu a fost găsită.');
  }
  const duplicate = await WaitlistEntry.findOne({
    where: {
      userId,
      resourceId: input.resourceId,
      status: { [Op.in]: ['waiting', 'notified'] },
      desiredStart: { [Op.lt]: end },
      desiredEnd: { [Op.gt]: start },
    },
  });
  if (duplicate) {
    throw new ApiError(
      409,
      'WAITLIST_CONFLICT',
      'Ai deja o înregistrare pentru acest interval.',
    );
  }
  return WaitlistEntry.create({
    userId,
    resourceId: input.resourceId,
    desiredStart: start,
    desiredEnd: end,
    requirements: input.requirements ?? {},
  });
}

export async function removeWaitlistEntry(id, actor) {
  const entry = await WaitlistEntry.findByPk(id);
  if (!entry) {
    throw new ApiError(404, 'NOT_FOUND', 'Înregistrarea nu a fost găsită.');
  }
  if (actor.role === 'user' && entry.userId !== actor.sub) {
    throw new ApiError(403, 'FORBIDDEN', 'Nu ai permisiunea.');
  }
  await entry.update({ status: 'expired' });
  return { id };
}
