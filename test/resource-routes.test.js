import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/research_resource_manager';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';

let app;
let User;
let Resource;

before(async () => {
  const models = await import('../src/models/index.js');
  User = models.User;
  Resource = models.Resource;
  const module = await import('../src/app.js');
  app = module.default;
});

const authenticatedUserId = 'd1b3efc4-48f4-4ec1-9af0-47eccb939600';

async function withAuthenticatedUser(role, active, callback) {
  const originalFindByPk = User.findByPk;
  User.findByPk = async (id) => ({
    id,
    role,
    isActive: active,
  });
  const token = jwt.sign({ role: 'manager' }, process.env.JWT_SECRET, {
    subject: authenticatedUserId,
  });

  try {
    await callback(`rrm.accessToken=${token}`);
  } finally {
    User.findByPk = originalFindByPk;
  }
}

test('health endpoint confirms the API is available', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('resource query validation rejects an incomplete availability range', async () => {
  await withAuthenticatedUser('user', true, async (cookie) => {
    const response = await request(app)
      .get('/api/resources?availableFrom=2025-01-01T10:00:00Z')
      .set('Cookie', cookie);

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'BAD_REQUEST');
    assert.equal('details' in response.body, false);
  });
});

test('resource reads require an authenticated session', async () => {
  const response = await request(app).get('/api/resources');

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'UNAUTHORIZED');
});

test('archived resource reads require manager authorization', async () => {
  await withAuthenticatedUser('user', true, async (cookie) => {
    const response = await request(app)
      .get('/api/resources/archived')
      .set('Cookie', cookie);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });
});

test('managers can list archived resources', async () => {
  const originalFindAndCountAll = Resource.findAndCountAll;
  Resource.findAndCountAll = async ({ where }) => {
    assert.equal(where.isActive, false);
    return { count: 0, rows: [] };
  };

  try {
    await withAuthenticatedUser('manager', true, async (cookie) => {
      const response = await request(app)
        .get('/api/resources/archived')
        .set('Cookie', cookie);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data, []);
    });
  } finally {
    Resource.findAndCountAll = originalFindAndCountAll;
  }
});

test('managers can restore an archived resource', async () => {
  const originalUpdate = Resource.update;
  Resource.update = async (values, options) => {
    assert.deepEqual(values, { isActive: true });
    assert.equal(options.where.isActive, false);
    return [
      1,
      [
        {
          id: authenticatedUserId,
          name: 'Restored resource',
          type: 'equipment',
          description: '',
          location: 'Lab',
          state: 'available',
          specifications: {},
          managerId: null,
          isActive: true,
          createdAt: new Date('2025-01-10T09:00:00Z'),
          updatedAt: new Date('2025-05-01T10:30:00Z'),
        },
      ],
    ];
  };

  try {
    await withAuthenticatedUser('manager', true, async (cookie) => {
      const response = await request(app)
        .post(`/api/resources/${authenticatedUserId}/restore`)
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:8443');

      assert.equal(response.status, 200);
      assert.equal(response.body.isActive, true);
    });
  } finally {
    Resource.update = originalUpdate;
  }
});

test('restoring an unknown or active resource returns not found', async () => {
  const originalUpdate = Resource.update;
  Resource.update = async () => [0, []];

  try {
    await withAuthenticatedUser('manager', true, async (cookie) => {
      const response = await request(app)
        .post(`/api/resources/${authenticatedUserId}/restore`)
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:8443');

      assert.equal(response.status, 404);
      assert.equal(response.body.code, 'NOT_FOUND');
    });
  } finally {
    Resource.update = originalUpdate;
  }
});

test('login returns the user and sets an HttpOnly session cookie', async () => {
  const originalUnscoped = User.unscoped;
  const passwordHash = await bcrypt.hash('correct-password', 4);
  User.unscoped = () => ({
    findOne: async () => ({
      id: authenticatedUserId,
      fullName: 'Resource Manager',
      email: 'manager@example.edu',
      passwordHash,
      role: 'manager',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });

  try {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:8443')
      .send({
        email: 'manager@example.edu',
        password: 'correct-password',
      });

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body), ['user']);
    assert.match(response.headers['set-cookie'][0], /Expires=/i);
    assert.match(response.headers['set-cookie'][0], /Path=\//i);
    const sessionCookie = response.headers['set-cookie'].find((cookie) =>
      /Path=\/api/i.test(cookie),
    );
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /SameSite=Strict/i);
  } finally {
    User.unscoped = originalUnscoped;
  }
});

test('logout clears the session cookie', async () => {
  const response = await request(app)
    .post('/api/auth/logout')
    .set('Origin', 'http://localhost:8443');

  assert.equal(response.status, 204);
  assert.equal(response.headers['set-cookie'].length, 2);
  assert.match(response.headers['set-cookie'][0], /Path=\//i);
  assert.match(response.headers['set-cookie'][1], /Path=\/api/i);
});

test('resource creation requires an authenticated privileged user', async () => {
  const response = await request(app)
    .post('/api/resources')
    .send({ name: 'Resource' });

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'UNAUTHORIZED');
});

test('administrators can create resources', async () => {
  const originalCreate = Resource.create;
  const createdAt = new Date('2025-01-10T09:00:00Z');
  Resource.create = async (values) => ({
    id: authenticatedUserId,
    ...values,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  });

  try {
    await withAuthenticatedUser('administrator', true, async (cookie) => {
      const response = await request(app)
        .post('/api/resources')
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:8443')
        .send({
          name: 'Research microscope',
          type: 'equipment',
          location: 'Research lab',
        });

      assert.equal(response.status, 201);
      assert.equal(response.body.name, 'Research microscope');
    });
  } finally {
    Resource.create = originalCreate;
  }
});

test('resource creation rejects a user role from the database', async () => {
  await withAuthenticatedUser('user', true, async (cookie) => {
    const response = await request(app)
      .post('/api/resources')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:8443')
      .send({ name: 'Resource' });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });
});

test('deactivated accounts cannot use existing session cookies', async () => {
  await withAuthenticatedUser('manager', false, async (cookie) => {
    const response = await request(app)
      .post('/api/resources')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:8443')
      .send({ name: 'Resource' });

    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'UNAUTHORIZED');
  });
});

test('resource body validation returns field errors', async () => {
  await withAuthenticatedUser('manager', true, async (cookie) => {
    const response = await request(app)
      .post('/api/resources')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:8443')
      .send({ name: ' ', type: 'not-a-type', location: '' });

    assert.equal(response.status, 422);
    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.ok(response.body.details.some(({ field }) => field === 'name'));
  });
});

test('resource endpoints reject fields outside the OpenAPI input schema', async () => {
  await withAuthenticatedUser('manager', true, async (cookie) => {
    const response = await request(app)
      .post('/api/resources')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:8443')
      .send({
        name: 'Resource',
        type: 'equipment',
        location: 'Lab',
        unexpected: true,
      });

    assert.equal(response.status, 422);
    assert.equal(response.body.details[0].field, 'unexpected');
  });
});

test('cookie-authenticated writes reject untrusted browser origins', async () => {
  await withAuthenticatedUser('manager', true, async (cookie) => {
    const response = await request(app)
      .post('/api/resources')
      .set('Cookie', cookie)
      .set('Origin', 'https://attacker.example')
      .send({ name: 'Resource' });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });
});

test('login limits repeated failed attempts and reports the event', async () => {
  const originalUnscoped = User.unscoped;
  User.unscoped = () => ({ findOne: async () => null });

  try {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'manager@example.edu', password: 'wrong-password' });
      assert.equal(response.status, 401);
    }

    const limitedResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@example.edu', password: 'wrong-password' });

    assert.equal(limitedResponse.status, 429);
    assert.equal(limitedResponse.body.code, 'RATE_LIMITED');
  } finally {
    User.unscoped = originalUnscoped;
  }
});
