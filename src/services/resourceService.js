import { Op, cast, col, where as sequelizeWhere } from 'sequelize';
import { ApiError } from '../errors/ApiError.js';
import { Reservation, Resource, User } from '../models/index.js';

const ACTIVE_RESERVATION_STATES = ['pending', 'confirmed', 'in_progress'];

/**
 * Converts a Sequelize resource instance to the API's camelCase representation.
 */
function toResourceResponse(resource) {
  return {
    id: resource.id,
    name: resource.name,
    type: resource.type,
    description: resource.description,
    location: resource.location,
    state: resource.state,
    specifications: resource.specifications,
    managerId: resource.managerId,
    isActive: resource.isActive,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  };
}

function normalizeResourceInput(input) {
  return {
    name: input.name.trim(),
    type: input.type,
    description: input.description ?? '',
    location: input.location.trim(),
    state: input.state ?? 'available',
    specifications: input.specifications ?? {},
    managerId: input.managerId ?? null,
  };
}

/**
 * Returns active resources and pagination metadata for the catalog.
 */
async function listResourcesByStatus(query, isActive) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 20);
  const where = { isActive };

  if (query.search) {
    const searchPattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
    where[Op.or] = [
      ...['name', 'description', 'location'].map((field) => ({
        [field]: { [Op.iLike]: searchPattern },
      })),
      sequelizeWhere(cast(col('specifications'), 'text'), {
        [Op.iLike]: searchPattern,
      }),
    ];
  }

  if (query.type) {
    where.type = query.type;
  }

  if (query.state) {
    where.state = query.state;
  }

  if (isActive && query.availableFrom && query.availableTo) {
    const reservations = await Reservation.findAll({
      attributes: ['resourceId'],
      where: {
        status: { [Op.in]: ACTIVE_RESERVATION_STATES },
        startsAt: { [Op.lt]: new Date(query.availableTo) },
        endsAt: { [Op.gt]: new Date(query.availableFrom) },
      },
      raw: true,
    });
    const unavailableResourceIds = [
      ...new Set(reservations.map(({ resourceId }) => resourceId)),
    ];

    if (unavailableResourceIds.length > 0) {
      where.id = { [Op.notIn]: unavailableResourceIds };
    }
  }

  const { count, rows } = await Resource.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return {
    data: rows.map(toResourceResponse),
    pagination: {
      page,
      pageSize,
      totalItems: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

export async function listResources(query) {
  return listResourcesByStatus(query, true);
}

export async function listArchivedResources(query) {
  return listResourcesByStatus(query, false);
}

/**
 * Returns an active resource or raises the contract's not-found response.
 */
export async function getResource(resourceId) {
  const resource = await Resource.findOne({
    where: { id: resourceId, isActive: true },
  });

  if (!resource) {
    throw new ApiError(404, 'NOT_FOUND', 'Resursa nu a fost găsită.');
  }

  return toResourceResponse(resource);
}

async function validateManager(managerId) {
  if (!managerId) {
    return;
  }

  const manager = await User.findByPk(managerId);

  if (
    !manager ||
    !manager.isActive ||
    !['manager', 'administrator'].includes(manager.role)
  ) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Managerul selectat nu a fost găsit.',
      [{ field: 'managerId', message: 'Selectează un utilizator activ.' }],
    );
  }
}

/**
 * Validates references and persists a new resource.
 */
export async function createResource(input) {
  const values = normalizeResourceInput(input);
  await validateManager(values.managerId);

  const resource = await Resource.create(values);
  return toResourceResponse(resource);
}

/**
 * Replaces the editable fields of an active resource.
 */
export async function updateResource(resourceId, input) {
  const values = normalizeResourceInput(input);
  await validateManager(values.managerId);

  const [updatedCount, [resource]] = await Resource.update(values, {
    where: { id: resourceId, isActive: true },
    returning: true,
  });

  if (updatedCount === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Resursa nu a fost găsită.');
  }

  return toResourceResponse(resource);
}

/**
 * Soft-deletes a resource while preserving reservations and historical links.
 */
export async function archiveResource(resourceId) {
  const resource = await Resource.findOne({
    where: { id: resourceId, isActive: true },
  });

  if (!resource) {
    throw new ApiError(404, 'NOT_FOUND', 'Resursa nu a fost găsită.');
  }

  const activeReservation = await Reservation.findOne({
    where: {
      resourceId,
      status: { [Op.in]: ACTIVE_RESERVATION_STATES },
      endsAt: { [Op.gt]: new Date() },
    },
  });

  if (activeReservation) {
    throw new ApiError(
      409,
      'RESERVATION_CONFLICT',
      'Resursa are rezervări active sau viitoare.',
    );
  }

  await resource.update({ isActive: false });
}

/**
 * Re-activates an archived resource without changing its saved details.
 */
export async function restoreResource(resourceId) {
  const [updatedCount, [resource]] = await Resource.update(
    { isActive: true },
    {
      where: { id: resourceId, isActive: false },
      returning: true,
    },
  );

  if (updatedCount === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Resursa arhivată nu a fost găsită.');
  }

  return toResourceResponse(resource);
}
