import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { Op } from 'sequelize';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/research_resource_manager';

let Resource;
let Reservation;
let User;
let resourceService;

before(async () => {
  const models = await import('../src/models/index.js');
  const service = await import('../src/services/resourceService.js');
  Resource = models.Resource;
  Reservation = models.Reservation;
  User = models.User;
  resourceService = service;
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

const resource = {
  id: '29fe1434-a3ef-43be-a0fc-2ab4b52dd332',
  name: 'Robot de test',
  type: 'robot',
  description: '',
  location: 'Corp D',
  state: 'available',
  specifications: {},
  managerId: null,
  isActive: true,
  createdAt: new Date('2025-01-10T09:00:00Z'),
  updatedAt: new Date('2025-05-01T10:30:00Z'),
};

test('lists active resources with OpenAPI pagination metadata', async () => {
  await withStubs(
    [
      [
        Resource,
        'findAndCountAll',
        async () => ({ count: 1, rows: [resource] }),
      ],
    ],
    async () => {
      const result = await resourceService.listResources({
        page: '1',
        pageSize: '20',
      });

      assert.equal(result.data[0].name, resource.name);
      assert.deepEqual(result.pagination, {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      });
    },
  );
});

test('lists archived resources without including active resources', async () => {
  let queryOptions;
  await withStubs(
    [
      [
        Resource,
        'findAndCountAll',
        async (options) => {
          queryOptions = options;
          return { count: 1, rows: [{ ...resource, isActive: false }] };
        },
      ],
    ],
    async () => {
      const result = await resourceService.listArchivedResources({
        page: '1',
        pageSize: '20',
      });

      assert.equal(queryOptions.where.isActive, false);
      assert.equal(result.data[0].isActive, false);
      assert.equal(result.pagination.totalItems, 1);
    },
  );
});

test('search includes JSON specifications and treats wildcard characters literally', async () => {
  let queryOptions;
  await withStubs(
    [
      [
        Resource,
        'findAndCountAll',
        async (options) => {
          queryOptions = options;
          return { count: 0, rows: [] };
        },
      ],
    ],
    async () => {
      await resourceService.listResources({ search: 'laser%_unit' });

      const searchConditions = queryOptions.where[Op.or];
      assert.equal(searchConditions.length, 4);
      assert.equal(searchConditions[0].name[Op.iLike], '%laser\\%\\_unit%');
    },
  );
});

test('creates a normalized resource with database defaults', async () => {
  await withStubs(
    [[Resource, 'create', async (values) => ({ ...resource, ...values })]],
    async () => {
      const result = await resourceService.createResource({
        name: '  Resursă nouă  ',
        type: 'equipment',
        location: '  Corp A  ',
      });

      assert.equal(result.name, 'Resursă nouă');
      assert.equal(result.location, 'Corp A');
      assert.equal(result.state, 'available');
      assert.deepEqual(result.specifications, {});
    },
  );
});

test('rejects a managerId that belongs to a non-manager account', async () => {
  await withStubs(
    [
      [
        User,
        'findByPk',
        async () => ({ id: 'manager-id', isActive: true, role: 'user' }),
      ],
    ],
    async () => {
      await assert.rejects(
        resourceService.createResource({
          name: 'Resource',
          type: 'equipment',
          location: 'Lab',
          managerId: 'd1b3efc4-48f4-4ec1-9af0-47eccb939600',
        }),
        (error) => error.status === 422,
      );
    },
  );
});

test('updates an active resource and returns its database representation', async () => {
  await withStubs(
    [
      [Resource, 'findOne', async () => ({ ...resource, state: 'available' })],
      [
        Resource,
        'update',
        async () => [
          1,
          [{ ...resource, name: 'Robot actualizat', location: 'Corp E' }],
        ],
      ],
    ],
    async () => {
      const result = await resourceService.updateResource(resource.id, {
        name: 'Robot actualizat',
        type: 'robot',
        location: 'Corp E',
      });

      assert.equal(result.id, resource.id);
      assert.equal(result.name, 'Robot actualizat');
      assert.equal(result.location, 'Corp E');
    },
  );
});

test('archives a resource without physically deleting its record', async () => {
  let updatedValues;
  const resourceInstance = {
    ...resource,
    update: async (values) => {
      updatedValues = values;
    },
  };

  await withStubs(
    [
      [Resource, 'findOne', async () => resourceInstance],
      [Reservation, 'findOne', async () => null],
    ],
    async () => {
      await resourceService.archiveResource(resource.id);
      assert.deepEqual(updatedValues, { isActive: false });
    },
  );
});

test('restores an archived resource without changing its other fields', async () => {
  let updateOptions;
  await withStubs(
    [
      [
        Resource,
        'update',
        async (values, options) => {
          updateOptions = { values, options };
          return [1, [{ ...resource, isActive: true }]];
        },
      ],
    ],
    async () => {
      const result = await resourceService.restoreResource(resource.id);

      assert.deepEqual(updateOptions.values, { isActive: true });
      assert.equal(updateOptions.options.where.id, resource.id);
      assert.equal(updateOptions.options.where.isActive, false);
      assert.equal(result.isActive, true);
    },
  );
});

test('does not restore a resource that is missing or already active', async () => {
  await withStubs([[Resource, 'update', async () => [0, []]]], async () => {
    await assert.rejects(
      resourceService.restoreResource(resource.id),
      (error) => error.status === 404,
    );
  });
});

test('prevents archiving a resource with an active reservation', async () => {
  await withStubs(
    [
      [Resource, 'findOne', async () => resource],
      [Reservation, 'findOne', async () => ({ id: 'reservation-id' })],
    ],
    async () => {
      await assert.rejects(
        resourceService.archiveResource(resource.id),
        (error) => error.status === 409,
      );
    },
  );
});
