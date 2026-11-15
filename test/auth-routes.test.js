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

before(async () => {
  const models = await import('../src/models/index.js');
  User = models.User;
  const module = await import('../src/app.js');
  app = module.default;
});

const userId = 'd1b3efc4-48f4-4ec1-9af0-47eccb939600';

test('registration stores a bcrypt hash and returns a regular user', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  let createdValues;
  User.findOne = async () => null;
  User.create = async (values) => {
    createdValues = values;
    return {
      id: userId,
      fullName: values.fullName,
      email: values.email,
      role: values.role,
      isActive: true,
      createdAt: new Date('2025-01-15T10:00:00Z'),
      updatedAt: new Date('2025-01-15T10:00:00Z'),
    };
  };

  try {
    const response = await request(app).post('/api/auth/register').send({
      fullName: '  Andrei Ionescu  ',
      email: 'ANDREI@example.edu',
      password: 'a-long-registration-password',
    });

    assert.equal(response.status, 201);
    assert.equal(createdValues.fullName, 'Andrei Ionescu');
    assert.equal(createdValues.email, 'andrei@example.edu');
    assert.equal(createdValues.role, 'user');
    assert.notEqual(createdValues.passwordHash, 'a-long-registration-password');
    assert.equal(
      await bcrypt.compare(
        'a-long-registration-password',
        createdValues.passwordHash,
      ),
      true,
    );
    assert.deepEqual(response.body.user, {
      id: userId,
      fullName: 'Andrei Ionescu',
      email: 'andrei@example.edu',
      role: 'user',
      isActive: true,
      createdAt: '2025-01-15T10:00:00.000Z',
      updatedAt: '2025-01-15T10:00:00.000Z',
    });
    assert.equal('passwordHash' in response.body.user, false);
    assert.equal(response.headers['set-cookie'], undefined);
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test('registration rejects invalid data and privileged role fields', async () => {
  const invalidPassword = await request(app).post('/api/auth/register').send({
    fullName: 'Andrei Ionescu',
    email: 'andrei@example.edu',
    password: 'short',
  });
  const privilegedRole = await request(app).post('/api/auth/register').send({
    fullName: 'Andrei Ionescu',
    email: 'andrei@example.edu',
    password: 'a-long-registration-password',
    role: 'administrator',
  });

  assert.equal(invalidPassword.status, 422);
  assert.equal(invalidPassword.body.code, 'VALIDATION_ERROR');
  assert.equal(privilegedRole.status, 422);
  assert.equal(
    privilegedRole.body.details.some(({ field }) => field === 'role'),
    true,
  );
});

test('registration reports duplicate email without creating a session', async () => {
  const originalFindOne = User.findOne;
  User.findOne = async () => ({ id: userId });

  try {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Andrei Ionescu',
      email: 'andrei@example.edu',
      password: 'a-long-registration-password',
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'EMAIL_IN_USE');
    assert.equal(response.headers['set-cookie'], undefined);
  } finally {
    User.findOne = originalFindOne;
  }
});

test('login rejects an incorrect password', async () => {
  const originalUnscoped = User.unscoped;
  const passwordHash = await bcrypt.hash('correct-password', 4);
  User.unscoped = () => ({
    findOne: async () => ({
      id: userId,
      fullName: 'Andrei Ionescu',
      email: 'andrei@example.edu',
      passwordHash,
      role: 'user',
      isActive: true,
    }),
  });

  try {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'andrei@example.edu', password: 'wrong-password' });

    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'UNAUTHORIZED');
    assert.equal(response.headers['set-cookie'], undefined);
  } finally {
    User.unscoped = originalUnscoped;
  }
});

test('the current-user endpoint rejects an invalid JWT cookie', async () => {
  const response = await request(app)
    .get('/api/auth/me')
    .set('Cookie', 'rrm.accessToken=invalid');

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'UNAUTHORIZED');
});

test('the current-user endpoint returns a sanitized profile for a valid JWT', async () => {
  const originalFindByPk = User.findByPk;
  const user = {
    id: userId,
    fullName: 'Andrei Ionescu',
    email: 'andrei@example.edu',
    role: 'user',
    isActive: true,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
  };
  User.findByPk = async () => user;
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: userId });

  try {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `rrm.accessToken=${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.email, 'andrei@example.edu');
    assert.equal('passwordHash' in response.body, false);
  } finally {
    User.findByPk = originalFindByPk;
  }
});
