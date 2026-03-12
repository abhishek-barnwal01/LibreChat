'use strict';

const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const checkAdmin = require('~/server/middleware/roles/admin');
const {
  listUsersController,
  updateUserDataAccessController,
  updateUserRoleController,
} = require('~/server/controllers/AdminController');

const router = express.Router();

// All routes require valid JWT + admin role
router.use(requireJwtAuth, checkAdmin);

router.get('/users', listUsersController);
router.patch('/users/data-access', updateUserDataAccessController);
router.patch('/users/role', updateUserRoleController);

module.exports = router;
