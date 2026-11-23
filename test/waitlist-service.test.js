import assert from 'node:assert/strict';
import { before, test } from 'node:test';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/research_resource_manager';

let waitlistService;

before(async () => {
  waitlistService = await import('../src/services/waitlistService.js');
});

test('rejects waitlist intervals that start in the past', async () => {
  const startsAt = new Date(Date.now() - 60_000);
  const endsAt = new Date(Date.now() + 60_000);

  await assert.rejects(
    waitlistService.createWaitlistEntry(
      {
        resourceId: '29fe1434-a3ef-43be-a0fc-2ab4b52dd332',
        desiredStart: startsAt.toISOString(),
        desiredEnd: endsAt.toISOString(),
      },
      '8b28915c-fc35-4f90-b03b-5cf41a95a66d',
    ),
    (error) => error.status === 400 && error.code === 'VALIDATION_ERROR',
  );
});
