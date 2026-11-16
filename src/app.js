import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import authRoutes from './routes/authRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import maintenanceRoutes from './routes/maintenanceRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

function validateBrowserOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const origin = req.get('origin');
  const hasSessionCookie = Boolean(req.get('cookie'));
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:8443';

  if ((origin && origin !== frontendOrigin) || (hasSessionCookie && !origin)) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Originea cererii nu este permisă.',
    });
  }

  return next();
}

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:8443',
    credentials: true,
  }),
);
app.use('/api', validateBrowserOrigin);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/maintenance-blocks', maintenanceRoutes);
app.use(errorHandler);

export default app;
