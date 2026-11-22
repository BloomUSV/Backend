import { ApiError } from '../errors/ApiError.js';
import { Notification } from '../models/index.js';

export async function listNotifications(userId) {
  return Notification.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
  });
}

export async function markNotificationRead(id, userId) {
  const [count] = await Notification.update(
    { isRead: true },
    { where: { id, userId } },
  );
  if (count === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Notificarea nu a fost găsită.');
  }
  return Notification.findByPk(id);
}

export async function markAllNotificationsRead(userId) {
  await Notification.update(
    { isRead: true },
    { where: { userId, isRead: false } },
  );
  return { updated: true };
}
