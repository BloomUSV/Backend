import { Op } from 'sequelize';
import { ApiError } from '../errors/ApiError.js';
import {
  MaintenanceBlock,
  Notification,
  Reservation,
  Resource,
  User,
  WaitlistEntry,
} from '../models/index.js';
import { notifyWaitlistAvailable } from './waitlistService.js';

const ACTIVE = ['pending', 'confirmed', 'in_progress'];

function toReservation(value) {
  return {
    id: value.id,
    userId: value.userId,
    resourceId: value.resourceId,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    purpose: value.purpose,
    teamName: value.teamName,
    status: value.status,
    reviewedBy: value.reviewedBy,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

async function assertResourceAvailable(resourceId, start, end, excludeId) {
  const resource = await Resource.findOne({
    where: { id: resourceId, isActive: true },
  });
  if (!resource) {
    throw new ApiError(404, 'NOT_FOUND', 'Resursa nu a fost găsită.');
  }
  if (resource.state === 'maintenance') {
    throw new ApiError(
      409,
      'RESOURCE_UNAVAILABLE',
      'Resursa este în mentenanță.',
    );
  }

  const where = {
    resourceId,
    status: { [Op.in]: ACTIVE },
    startsAt: { [Op.lt]: end },
    endsAt: { [Op.gt]: start },
  };
  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  if (await Reservation.findOne({ where })) {
    throw new ApiError(
      409,
      'RESERVATION_CONFLICT',
      'Intervalul se suprapune cu o rezervare existentă.',
    );
  }
  if (
    await MaintenanceBlock.findOne({
      where: {
        resourceId,
        startsAt: { [Op.lt]: end },
        endsAt: { [Op.gt]: start },
      },
    })
  ) {
    throw new ApiError(
      409,
      'RESOURCE_UNAVAILABLE',
      'Intervalul se suprapune cu o perioadă de mentenanță.',
    );
  }
  return resource;
}

export async function listReservations({ userId, scope }) {
  const where = scope === 'own' ? { userId } : {};
  const rows = await Reservation.findAll({
    where,
    order: [['startsAt', 'DESC']],
  });
  return rows.map(toReservation);
}

export async function createReservation(input, actor) {
  if (actor.role !== 'user') {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Doar utilizatorii pot crea rezervări personale.',
    );
  }
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
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

  await assertResourceAvailable(input.resourceId, start, end);
  const userId =
    actor.role === 'manager' || actor.role === 'administrator'
      ? input.userId
      : actor.sub;
  if (!userId) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Utilizatorul este obligatoriu.',
    );
  }
  if (actor.role === 'manager' || actor.role === 'administrator') {
    const targetUser = await User.findByPk(userId);
    if (!targetUser || !targetUser.isActive) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Utilizatorul selectat nu este activ.',
      );
    }
  }

  const reservation = await Reservation.create({
    userId,
    resourceId: input.resourceId,
    startsAt: start,
    endsAt: end,
    purpose: input.purpose?.trim() || '',
    teamName: input.teamName?.trim() || null,
    status: 'pending',
  });
  await WaitlistEntry.update(
    { status: 'confirmed' },
    {
      where: {
        userId,
        resourceId: input.resourceId,
        status: { [Op.in]: ['waiting', 'notified'] },
        desiredStart: { [Op.lt]: end },
        desiredEnd: { [Op.gt]: start },
      },
    },
  );
  return toReservation(reservation);
}

export async function updateReservation(id, input, actor) {
  if (actor.role !== 'user') {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Doar utilizatorul poate modifica propria rezervare.',
    );
  }
  const reservation = await Reservation.findByPk(id);
  if (!reservation) {
    throw new ApiError(404, 'NOT_FOUND', 'Rezervarea nu a fost găsită.');
  }
  if (actor.role === 'user' && reservation.userId !== actor.sub) {
    throw new ApiError(403, 'FORBIDDEN', 'Nu ai permisiunea.');
  }
  if (!['pending', 'confirmed'].includes(reservation.status)) {
    throw new ApiError(
      409,
      'RESERVATION_CONFLICT',
      'Rezervarea nu mai poate fi modificată.',
    );
  }

  const start = new Date(input.startsAt ?? reservation.startsAt);
  const end = new Date(input.endsAt ?? reservation.endsAt);
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
  await assertResourceAvailable(
    reservation.resourceId,
    start,
    end,
    reservation.id,
  );
  await reservation.update({
    startsAt: start,
    endsAt: end,
    purpose: input.purpose?.trim() ?? reservation.purpose,
    teamName: input.teamName?.trim() ?? reservation.teamName,
  });
  await Notification.create({
    userId: reservation.userId,
    reservationId: reservation.id,
    message: 'Data sau intervalul rezervării tale a fost modificat.',
    type: 'booking_confirmed',
  });
  return toReservation(reservation);
}

export async function cancelReservation(id, actor) {
  if (!['user', 'manager'].includes(actor.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Rolul nu poate administra anulări.');
  }
  const reservation = await Reservation.findByPk(id);
  if (!reservation) {
    throw new ApiError(404, 'NOT_FOUND', 'Rezervarea nu a fost găsită.');
  }
  if (actor.role === 'user' && reservation.userId !== actor.sub) {
    throw new ApiError(403, 'FORBIDDEN', 'Nu ai permisiunea.');
  }
  if (!ACTIVE.includes(reservation.status)) {
    throw new ApiError(
      409,
      'RESERVATION_CONFLICT',
      'Rezervarea nu mai poate fi anulată.',
    );
  }

  const start = reservation.startsAt;
  const end = reservation.endsAt;
  await reservation.update({ status: 'cancelled' });
  await Notification.create({
    userId: reservation.userId,
    reservationId: reservation.id,
    message: 'Rezervarea ta a fost anulată.',
    type: 'booking_cancelled',
  });
  await notifyWaitlistAvailable(reservation.resourceId, start, end);
  return toReservation(reservation);
}

export async function reviewReservation(id, status, actor) {
  if (actor.role !== 'manager') {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Doar managerii pot administra rezervările.',
    );
  }
  if (!['confirmed', 'rejected'].includes(status)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Starea aprobării nu este validă.',
    );
  }
  const reservation = await Reservation.findByPk(id);
  if (!reservation) {
    throw new ApiError(404, 'NOT_FOUND', 'Rezervarea nu a fost găsită.');
  }
  if (reservation.status !== 'pending') {
    throw new ApiError(
      409,
      'RESERVATION_CONFLICT',
      'Rezervarea nu mai poate fi evaluată.',
    );
  }
  await reservation.update({
    status,
    reviewedBy: actor.sub,
  });

  if (status === 'confirmed') {
    await Notification.create({
      userId: reservation.userId,
      reservationId: reservation.id,
      message: 'Rezervarea ta a fost confirmată.',
      type: 'booking_confirmed',
    });
  } else {
    await Notification.create({
      userId: reservation.userId,
      reservationId: reservation.id,
      message: 'Rezervarea ta a fost respinsă.',
      type: 'booking_cancelled',
    });
  }
  return toReservation(reservation);
}
