import 'dotenv/config';
import app from './app.js';
import { sequelize } from './config/database.js';

const port = Number(process.env.PORT || 3001);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters.');
}

try {
  await sequelize.authenticate();
  app.listen(port, () => {
    console.info(`Research Resource Manager API listening on port ${port}.`);
  });
} catch (error) {
  console.error('Unable to start the API server.', error);
  process.exitCode = 1;
}
