import {
  archiveResource,
  createResource,
  getResource,
  listArchivedResources,
  listResources,
  restoreResource,
  updateResource,
} from '../services/resourceService.js';

export async function getResources(req, res, next) {
  try {
    const result = await listResources(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getArchivedResources(req, res, next) {
  try {
    const result = await listArchivedResources(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getResourceById(req, res, next) {
  try {
    const resource = await getResource(req.params.resourceId);
    return res.status(200).json(resource);
  } catch (error) {
    return next(error);
  }
}

export async function postResource(req, res, next) {
  try {
    const resource = await createResource(req.body);
    return res.status(201).json(resource);
  } catch (error) {
    return next(error);
  }
}

export async function putResource(req, res, next) {
  try {
    const resource = await updateResource(req.params.resourceId, req.body);
    return res.status(200).json(resource);
  } catch (error) {
    return next(error);
  }
}

export async function deleteResource(req, res, next) {
  try {
    await archiveResource(req.params.resourceId);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

export async function restoreArchivedResource(req, res, next) {
  try {
    const resource = await restoreResource(req.params.resourceId);
    return res.status(200).json(resource);
  } catch (error) {
    return next(error);
  }
}
