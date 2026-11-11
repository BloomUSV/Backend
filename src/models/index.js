import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    fullName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'full_name',
    },
    email: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
    },
    role: {
      type: DataTypes.ENUM('user', 'manager', 'administrator'),
      allowNull: false,
      defaultValue: 'user',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    tableName: 'users',
    defaultScope: {
      attributes: { exclude: ['passwordHash'] },
    },
  },
);

export const Resource = sequelize.define(
  'Resource',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(
        'equipment',
        'robot',
        'cluster',
        'laboratory',
        'room',
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    location: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    state: {
      type: DataTypes.ENUM('available', 'unavailable', 'maintenance'),
      allowNull: false,
      defaultValue: 'available',
    },
    specifications: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    managerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'manager_id',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  },
  { tableName: 'resources' },
);

export const Reservation = sequelize.define(
  'Reservation',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    resourceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'resource_id',
    },
    startsAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'starts_at',
    },
    endsAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'ends_at',
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
        'rejected',
        'expired',
      ),
      allowNull: false,
    },
  },
  {
    tableName: 'reservations',
    updatedAt: false,
    createdAt: false,
  },
);
