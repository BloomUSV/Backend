import { ApiError } from '../errors/ApiError.js';
import { Resource, ResourceRule } from '../models/index.js';

export async function listRules(resourceId) {
  const where = resourceId ? { resourceId } : {};
  const rules = await ResourceRule.findAll({
    where,
    order: [['createdAt', 'ASC']],
    raw: true,
  });
  const resourceIds = [...new Set(rules.map((rule) => rule.resourceId))];
  let resources = [];
  if (resourceIds.length > 0) {
    resources = await Resource.findAll({
      where: { id: resourceIds },
      attributes: ['id', 'name'],
      raw: true,
    });
  }
  const names = Object.fromEntries(
    resources.map((resource) => [resource.id, resource.name]),
  );
  return rules.map((rule) => ({
    ...rule,
    resourceName: names[rule.resourceId] || null,
  }));
}

export async function createRule(input) {
  const resource = await Resource.findByPk(input.resourceId);
  if (!resource) {
    throw new ApiError(404, 'NOT_FOUND', 'Resursa nu a fost găsită.');
  }
  return ResourceRule.create({
    resourceId: input.resourceId,
    title: input.title.trim(),
    content: input.content.trim(),
  });
}

export async function updateRule(id, input) {
  const rule = await ResourceRule.findByPk(id);
  if (!rule) {
    throw new ApiError(404, 'NOT_FOUND', 'Regula nu a fost găsită.');
  }
  await rule.update({
    title: input.title.trim(),
    content: input.content.trim(),
  });
  return rule;
}

export async function deleteRule(id) {
  const deleted = await ResourceRule.destroy({ where: { id } });
  if (!deleted) {
    throw new ApiError(404, 'NOT_FOUND', 'Regula nu a fost găsită.');
  }
  return { id };
}
