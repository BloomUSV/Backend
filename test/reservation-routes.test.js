import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/research_resource_manager';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';

let app;
let MaintenanceBlock;
let Notification;
let Reservation;
let Resource;
let User;
let WaitlistEntry;

before(async () => {
  const models = await import('../src/models/index.js');
  MaintenanceBlock = models.MaintenanceBlock;
  Notification = models.Notification;
  Reservation = models.Reservation;
  Resource = models.Resource;
  User = models.User;
  WaitlistEntry = models.WaitlistEntry;
  app = (await import('../src/app.js')).default;
});

const managerId = 'd1b3efc4-48f4-4ec1-9af0-47eccb939600';
const reservationId = '29fe1434-a3ef-43be-a0fc-2ab4b52dd332';

async function withRole(role, callback) {
  const originalFindByPk = User.findByPk;
  User.findByPk = async (id) => ({
    id,
    role,
    isActive: true,
  });
  const token = jwt.sign({ role: 'user' }, process.env.JWT_SECRET, {
    subject: managerId,
  });

  try {
    await callback(`rrm.accessToken=${token}`);
  } finally {
    User.findByPk = originalFindByPk;
  }
}

test('manager can confirm a pending reservation through the API', async () => {
  const originalFindByPk = Reservation.findByPk;
  const originalCreate = Notification.create;
  const reservation = {
    id: reservationId,
    userId: 'user-1',
    resourceId: 'resource-1',
    startsAt: new Date('2026-12-01T10:00:00Z'),
    endsAt: new Date('2026-12-01T11:00:00Z'),
    status: 'pending',
    reviewedBy: null,
    update: async function (values) {
      Object.assign(this, values);
    },
  };
  Reservation.findByPk = async () => reservation;
  Notification.create = async (values) => values;

  try {
    await withRole('manager', async (cookie) => {
      const response = await request(app)
        .patch(`/api/reservations/${reservationId}/review`)
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:8443')
        .send({ status: 'confirmed' });

      assert.equal(response.status, 200);
      assert.equal(response.body.status, 'confirmed');
      assert.equal(response.body.reviewedBy, managerId);
    });
  } finally {
    Reservation.findByPk = originalFindByPk;
    Notification.create = originalCreate;
  }
});

test('regular users cannot review reservations through the API', async () => {
  await withRole('user', async (cookie) => {
    const response = await request(app)
      .patch(`/api/reservations/${reservationId}/review`)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:8443')
      .send({ status: 'confirmed' });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });
});

test('regular users can create reservations through the API', async () => {
  const originals = [
    [Resource, 'findOne', Resource.findOne],
    [Reservation, 'findOne', Reservation.findOne],
    [Reservation, 'create', Reservation.create],
    [MaintenanceBlock, 'findOne', MaintenanceBlock.findOne],
    [WaitlistEntry, 'update', WaitlistEntry.update],
  ];
  Resource.findOne = async () => ({ id: reservationId, state: 'available' });
  Reservation.findOne = async () => null;
  Reservation.create = async (values) => ({
    id: reservationId,
    ...values,
    reviewedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  MaintenanceBlock.findOne = async () => null;
  WaitlistEntry.update = async () => [0];

  try {
    await withRole('user', async (cookie) => {
      const startsAt = new Date(Date.now() + 60 * 60 * 1000);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      const response = await request(app)
        .post('/api/reservations')
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:8443')
        .send({
          resourceId: reservationId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        });

      assert.equal(response.status, 201);
      assert.equal(response.body.status, 'pending');
    });
  } finally {
    originals.forEach(([model, key, implementation]) => {
      model[key] = implementation;
    });
  }
});
