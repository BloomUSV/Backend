import { listUsers, updateUserAccess } from '../services/userService.js';

export async function getUsers(req, res, next) {
  try {
    const result = await listUsers(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const user = await updateUserAccess(req.params.userId, req.body);
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
}
