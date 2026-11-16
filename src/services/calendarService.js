import { Op } from 'sequelize';
import { ApiError } from '../errors/ApiError.js';
import { MaintenanceBlock, Reservation, Resource } from '../models/index.js';

const CALENDAR_RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
];

/**
 * Normalizează un eveniment de calendar în formatul de răspuns al API-ului.
 */
function toCalendarEvent(event, type, resourceName) {
  return {
    id: event.id,
    resourceId: event.resourceId,
    resourceName,
    reservationId: type === 'reservation' ? event.id : null,
    maintenanceBlockId: type === 'maintenance' ? event.id : null,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    status: type === 'maintenance' ? 'maintenance' : event.status,
    type,
    title:
      type === 'maintenance'
        ? `Mentenanță: ${event.reason}`
        : `Rezervare (${event.status})`,
    reason: type === 'maintenance' ? event.reason : null,
  };
}

/**
 * Returnează evenimentele de calendar (rezervări active și blocuri de mentenanță)
 * pentru un interval de timp, opțional filtrate după resursă.
 */
export async function getCalendarEvents({ start, end, resourceId, status }) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Intervalul de timp nu este valid.');
  }

  if (startDate >= endDate) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Sfârșitul intervalului trebuie să fie ulterior începutului.');
  }

  if (resourceId) {
    const resource = await Resource.findOne({
      where: { id: resourceId, isActive: true },
      attributes: ['id', 'name'],
    });
    if (!resource) {
      throw new ApiError(404, 'NOT_FOUND', 'Resursa nu a fost găsită.');
    }
  }

  const reservationWhere = {
    startsAt: { [Op.lt]: endDate },
    endsAt: { [Op.gt]: startDate },
  };

  if (resourceId) {
    reservationWhere.resourceId = resourceId;
  }

  if (status) {
    reservationWhere.status = status;
  } else {
    reservationWhere.status = { [Op.in]: CALENDAR_RESERVATION_STATUSES };
  }

  const [reservations, maintenanceBlocks, resources] = await Promise.all([
    Reservation.findAll({
      where: reservationWhere,
      order: [['startsAt', 'ASC']],
      raw: true,
    }),
    MaintenanceBlock.findAll({
      where: resourceId ? { resourceId } : {},
      order: [['startsAt', 'ASC']],
      raw: true,
    }),
    resourceId
      ? Resource.findAll({
          where: { id: resourceId, isActive: true },
          attributes: ['id', 'name'],
          raw: true,
        })
      : Resource.findAll({
          where: { isActive: true },
          attributes: ['id', 'name'],
          raw: true,
        }),
  ]);

  const resourceNames = Object.fromEntries(
    resources.map((r) => [r.id, r.name]),
  );

  const events = [];

  for (const reservation of reservations) {
    if (resourceNames[reservation.resourceId]) {
      events.push(
        toCalendarEvent(reservation, 'reservation', resourceNames[reservation.resourceId]),
      );
    }
  }

  for (const block of maintenanceBlocks) {
    if (resourceNames[block.resourceId]) {
      events.push(
        toCalendarEvent(block, 'maintenance', resourceNames[block.resourceId]),
      );
    }
  }

  events.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  return events;
}