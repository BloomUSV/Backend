import { Sequelize } from 'sequelize';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be configured.');
}

export const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
});
