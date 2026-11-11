import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/database.js';
import { User } from '../models/index.js';

async function createManager() {
  const { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_PASSWORD) {
    throw new Error(
      'Set ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD before creating a manager.',
    );
  }

  if (ADMIN_PASSWORD.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  }

  await sequelize.authenticate();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await User.create({
    fullName: ADMIN_NAME.trim(),
    email: ADMIN_EMAIL.trim().toLowerCase(),
    passwordHash,
    role: 'manager',
    isActive: true,
  });

  console.info(`Manager account created for ${ADMIN_EMAIL}.`);
}

try {
  await createManager();
} catch (error) {
  console.error('Unable to create manager account.', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
