import { getCalendarEvents } from '../services/calendarService.js';

export async function listCalendarEvents(req, res, next) {
  try {
    const events = await getCalendarEvents({
      start: req.query.start,
      end: req.query.end,
      resourceId: req.query.resourceId,
      status: req.query.status,
    });
    return res.status(200).json(events);
  } catch (error) {
    return next(error);
  }
}