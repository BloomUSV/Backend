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
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
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
      defaultValue: 'pending',
    },
    purpose: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    teamName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'team_name',
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reviewed_by',
    },
  },
  {
    tableName: 'reservations',
    underscored: true,
  },
);

export const WaitlistEntry = sequelize.define(
  'WaitlistEntry',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    resourceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'resource_id',
    },
    desiredStart: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'desired_start',
    },
    desiredEnd: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'desired_end',
    },
    requirements: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    status: {
      type: DataTypes.ENUM('waiting', 'notified', 'confirmed', 'expired'),
      allowNull: false,
      defaultValue: 'waiting',
    },
  },
  { tableName: 'waitlist_entries', underscored: true },
);

export const Notification = sequelize.define(
  'Notification',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    reservationId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reservation_id',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(
        'booking_confirmed',
        'booking_cancelled',
        'slot_available',
        'resource_maintenance',
      ),
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_read',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
  },
  {
    tableName: 'notifications',
    timestamps: false,
  },
);

export const Feedback = sequelize.define(
  'Feedback',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    resourceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'resource_id',
    },
    rating: {
      type: DataTypes.SMALLINT,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'feedback',
    updatedAt: false,
  },
);

export const ResourceRule = sequelize.define(
  'ResourceRule',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    resourceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'resource_id',
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  { tableName: 'resource_rules', underscored: true },
);

export const MaintenanceBlock = sequelize.define(
  'MaintenanceBlock',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
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
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
    },
  },
  {
    tableName: 'maintenance_blocks',
    updatedAt: false,
    createdAt: false,
  },
);
