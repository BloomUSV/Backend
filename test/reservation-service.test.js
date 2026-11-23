import assert from 'node:assert/strict';
import { before, test } from 'node:test';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/research_resource_manager';

let models;
let reservationService;

before(async () => {
  models = await import('../src/models/index.js');
  reservationService = await import('../src/services/reservationService.js');
});

async function withStubs(stubs, callback) {
  const originals = stubs.map(([model, key]) => [model, key, model[key]]);
  stubs.forEach(([model, key, implementation]) => {
    model[key] = implementation;
  });
  try {
    await callback();
  } finally {
    originals.forEach(([model, key, original]) => {
      model[key] = original;
    });
  }
}

test('rejects reservations that overlap an active booking', async () => {
  await withStubs(
    [
      [
        models.Resource,
        'findOne',
        async () => ({
          id: '29fe1434-a3ef-43be-a0fc-2ab4b52dd332',
          state: 'available',
        }),
      ],
      [
        models.Reservation,
        'findOne',
        async () => ({
          id: 'existing-reservation',
        }),
      ],
    ],
    async () => {
      await assert.rejects(
        reservationService.createReservation(
          {
            resourceId: '29fe1434-a3ef-43be-a0fc-2ab4b52dd332',
            startsAt: '2026-12-01T10:00:00Z',
            endsAt: '2026-12-01T11:00:00Z',
          },
          {
            sub: '8b28915c-fc35-4f90-b03b-5cf41a95a66d',
            role: 'user',
          },
        ),
        (error) =>
          error.status === 409 && error.code === 'RESERVATION_CONFLICT',
      );
    },
  );
});

test('rejects past reservation intervals when creating or modifying', async () => {
  const startsAt = new Date(Date.now() - 60_000);
  const endsAt = new Date(Date.now() + 60_000);
  const reservation = {
    id: 'reservation-1',
    userId: '8b28915c-fc35-4f90-b03b-5cf41a95a66d',
    status: 'confirmed',
  };

  await assert.rejects(
    reservationService.createReservation(
      {
        resourceId: '29fe1434-a3ef-43be-a0fc-2ab4b52dd332',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      },
      {
        sub: reservation.userId,
        role: 'user',
      },
    ),
    (error) => error.status === 400 && error.code === 'VALIDATION_ERROR',
  );

  await withStubs(
    [[models.Reservation, 'findByPk', async () => reservation]],
    async () => {
      await assert.rejects(
        reservationService.updateReservation(
          reservation.id,
          {
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          },
          {
            sub: reservation.userId,
            role: 'user',
          },
        ),
        (error) => error.status === 400 && error.code === 'VALIDATION_ERROR',
      );
    },
  );
});

test('manager and administrator cannot create personal reservations', async () => {
  for (const role of ['manager', 'administrator']) {
    await assert.rejects(
      reservationService.createReservation(
        {
          resourceId: '29fe1434-a3ef-43be-a0fc-2ab4b52dd332',
          startsAt: '2026-12-01T10:00:00Z',
          endsAt: '2026-12-01T11:00:00Z',
        },
        {
          sub: '8b28915c-fc35-4f90-b03b-5cf41a95a66d',
          role,
        },
      ),
      (error) => error.status === 403,
    );
  }
});

test('rejects reservations that overlap a maintenance period', async () => {
  await withStubs(
    [
      [
        models.Resource,
        'findOne',
        async () => ({
          id: '29fe1434-a3ef-43be-a0fc-2ab4b52dd332',
          state: 'available',
        }),
      ],
      [models.Reservation, 'findOne', async () => null],
      [
        models.MaintenanceBlock,
        'findOne',
        async () => ({ id: 'maintenance-1' }),
      ],
    ],
    async () => {
      await assert.rejects(
        reservationService.createReservation(
          {
            resourceId: '29fe1434-a3ef-43be-a0fc-2ab4b52dd332',
            startsAt: '2026-12-01T10:00:00Z',
            endsAt: '2026-12-01T11:00:00Z',
          },
          {
            sub: '8b28915c-fc35-4f90-b03b-5cf41a95a66d',
            role: 'user',
          },
        ),
        (error) =>
          error.status === 409 && error.code === 'RESOURCE_UNAVAILABLE',
      );
    },
  );
});

test('cancelling a booking changes status and creates a notification', async () => {
  let notificationInput;
  let waitlistOptions;
  const reservation = {
    id: 'reservation-1',
    userId: '8b28915c-fc35-4f90-b03b-5cf41a95a66d',
    resourceId: '29fe1434-a3ef-43be-a0fc-2ab4b52dd332',
    startsAt: new Date('2026-12-01T10:00:00Z'),
    endsAt: new Date('2026-12-01T11:00:00Z'),
    status: 'confirmed',
    purpose: '',
    teamName: null,
    reviewedBy: null,
    update: async function (values) {
      Object.assign(this, values);
    },
  };

  await withStubs(
    [
      [models.Reservation, 'findByPk', async () => reservation],
      [
        models.Notification,
        'create',
        async (input) => {
          notificationInput = input;
          return input;
        },
      ],
      [
        models.WaitlistEntry,
        'findAll',
        async (options) => {
          waitlistOptions = options;
          return [];
        },
      ],
    ],
    async () => {
      const result = await reservationService.cancelReservation(
        reservation.id,
        {
          sub: reservation.userId,
          role: 'user',
        },
      );
      assert.equal(result.status, 'cancelled');
      assert.equal(notificationInput.type, 'booking_cancelled');
      assert.equal(waitlistOptions.where.resourceId, reservation.resourceId);
    },
  );
});
