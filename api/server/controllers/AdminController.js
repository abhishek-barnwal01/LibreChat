'use strict';

const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { findUser, updateUser } = require('~/models');

/**
 * PATCH /api/admin/users/data-access
 * Body: { email: string, dataAccess: { productCategories: string[]|null, countries: string[]|null } }
 * Sets per-user Azure AI Search data access restrictions.
 */
const updateUserDataAccessController = async (req, res) => {
  try {
    const { email, dataAccess } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const target = await findUser({ email });
    if (!target) {
      return res.status(404).json({ message: `No user found with email: ${email}` });
    }

    // Use a direct Mongoose update with strict:false so that the dataAccess field
    // is written even if the currently-compiled schema dist doesn't include it yet.
    // runValidators:false avoids [String]+null type-coercion failures.
    const User = mongoose.models.User;
    const updated = await User.findByIdAndUpdate(
      target._id,
      { $set: { dataAccess: dataAccess ?? null } },
      { new: true, runValidators: false, strict: false },
    ).lean();

    logger.info(`[AdminController] dataAccess updated for ${email} by admin ${req.user.email}`);

    // Fire-and-forget: bust the FastAPI server's in-process user cache so the
    // new dataAccess rules are picked up immediately without a server restart.
    const ragUrl = process.env.GCPL_RAG_URL || 'http://localhost:5001';
    const cacheSecret = process.env.GCPL_RAG_CACHE_SECRET || '';
    fetch(`${ragUrl}/admin/cache/invalidate/${target._id}`, {
      method: 'POST',
      headers: cacheSecret ? { 'X-Cache-Secret': cacheSecret } : {},
    }).catch((e) =>
      logger.warn(`[AdminController] RAG cache invalidation failed for ${email}: ${e.message}`),
    );

    return res.status(200).json({
      message: 'Data access updated successfully',
      user: { email: updated.email, dataAccess: updated.dataAccess },
    });
  } catch (err) {
    logger.error('[AdminController] updateUserDataAccessController error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * PATCH /api/admin/users/role
 * Body: { email: string, role: 'ADMIN'|'USER' }
 * Grants or revokes admin role for a user.
 */
const updateUserRoleController = async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const allowedRoles = [SystemRoles.ADMIN, SystemRoles.USER];
    if (!allowedRoles.includes(role)) {
      return res
        .status(400)
        .json({ message: `role must be one of: ${allowedRoles.join(', ')}` });
    }

    if (email === req.user.email) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }

    const target = await findUser({ email });
    if (!target) {
      return res.status(404).json({ message: `No user found with email: ${email}` });
    }

    const updated = await updateUser(target._id.toString(), { role });
    logger.info(
      `[AdminController] role set to "${role}" for ${email} by admin ${req.user.email}`,
    );

    return res.status(200).json({
      message: 'Role updated successfully',
      user: { email: updated.email, role: updated.role },
    });
  } catch (err) {
    logger.error('[AdminController] updateUserRoleController error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * GET /api/admin/users
 * Returns all users with id, email, name, role, and dataAccess.
 */
const listUsersController = async (req, res) => {
  try {
    const User = mongoose.models.User;
    const users = await User.find({}, 'email name role dataAccess').lean();
    return res.status(200).json({ users });
  } catch (err) {
    logger.error('[AdminController] listUsersController error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  listUsersController,
  updateUserDataAccessController,
  updateUserRoleController,
};
