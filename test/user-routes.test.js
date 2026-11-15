import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/research_resource_manager';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';

let app;
let User;

before(async () => {
  const models = await import('../src/models/index.js');
  User = models.User;
  const module = await import('../src/app.js');
  app = module.default;
});

const userId = 'd1b3efc4-48f4-4ec1-9af0-47eccb939600';
const targetUserId = '29fe1434-a3ef-43be-a0fc-2ab4b52dd332';

async function withRole(role, callback) {
  const originalFindByPk = User.findByPk;
  User.findByPk = async (id) => ({
    id,
    role,
    isActive: true,
  });
  const token = jwt.sign({ role: 'administrator' }, process.env.JWT_SECRET, {
    subject: userId,
  });

  try {
    await callback(`rrm.accessToken=${token}`);
  } finally {
    User.findByPk = originalFindByPk;
  }
}

test('only administrators can list user accounts', async () => {
  await withRole('user', async (cookie) => {
    const response = await request(app).get('/api/users').set('Cookie', cookie);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });

  await withRole('manager', async (cookie) => {
    const response = await request(app).get('/api/users').set('Cookie', cookie);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });
});

test('administrators can list users without exposing password hashes', async () => {
  const originalFindAndCountAll = User.findAndCountAll;
  const safeUser = {
    id: targetUserId,
    fullName: 'Andrei Ionescu',
    email: 'andrei@example.edu',
    role: 'user',
    isActive: true,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
  };
  User.findAndCountAll = async (options) => {
    assert.equal(options.attributes.includes('passwordHash'), false);
    return { count: 1, rows: [safeUser] };
  };

  try {
    await withRole('administrator', async (cookie) => {
      const response = await request(app)
        .get('/api/users?page=1&pageSize=10')
        .set('Cookie', cookie);

      assert.equal(response.status, 200);
      assert.equal(response.body.data[0].role, 'user');
      assert.equal('passwordHash' in response.body.data[0], false);
      assert.deepEqual(response.body.pagination, {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      });
    });
  } finally {
    User.findAndCountAll = originalFindAndCountAll;
  }
});

test('only administrators can change a user role', async () => {
  await withRole('manager', async (cookie) => {
    const response = await request(app)
      .patch(`/api/users/${targetUserId}`)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:8443')
      .send({ role: 'manager' });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });

  const originalFindByPk = User.findByPk;
  const user = {
    id: targetUserId,
    fullName: 'Andrei Ionescu',
    email: 'andrei@example.edu',
    role: 'user',
    isActive: true,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    update: async (updates) => Object.assign(user, updates),
  };
  User.findByPk = async (id) =>
    id === userId ? { id, role: 'administrator', isActive: true } : user;

  try {
    const token = jwt.sign({ role: 'user' }, process.env.JWT_SECRET, {
      subject: userId,
    });
    const response = await request(app)
      .patch(`/api/users/${targetUserId}`)
      .set('Cookie', `rrm.accessToken=${token}`)
      .set('Origin', 'http://localhost:8443')
      .send({ role: 'manager' });

    assert.equal(response.status, 200);
    assert.equal(response.body.role, 'manager');
    assert.equal('passwordHash' in response.body, false);
  } finally {
    User.findByPk = originalFindByPk;
  }
});

test('administrator account updates reject invalid roles and empty bodies', async () => {
  await withRole('administrator', async (cookie) => {
    const invalidRole = await request(app)
      .patch(`/api/users/${targetUserId}`)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:8443')
      .send({ role: 'owner' });
    const emptyBody = await request(app)
      .patch(`/api/users/${targetUserId}`)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:8443')
      .send({});

    assert.equal(invalidRole.status, 422);
    assert.equal(emptyBody.status, 422);
  });
});
