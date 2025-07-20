import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { UserController } from '../controllers/userController';
import { validateRequest } from '../middleware/validateRequest';
import { adminOnly } from '../middleware/adminOnly';

const router = Router();
const userController = new UserController();

// Get all users (admin only)
router.get('/', 
  adminOnly,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['name', 'email', 'createdAt']),
  validateRequest,
  userController.getAllUsers
);

// Get user by ID
router.get('/:id',
  param('id').isUUID(),
  validateRequest,
  userController.getUserById
);

// Get current user profile
router.get('/me/profile',
  userController.getCurrentUser
);

// Create new user (admin only)
router.post('/',
  adminOnly,
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)/),
  body('role').optional().isIn(['user', 'admin']),
  validateRequest,
  userController.createUser
);

// Update user
router.put('/:id',
  param('id').isUUID(),
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  validateRequest,
  userController.updateUser
);

// Change password
router.put('/:id/password',
  param('id').isUUID(),
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)/),
  validateRequest,
  userController.changePassword
);

// Delete user (admin only)
router.delete('/:id',
  adminOnly,
  param('id').isUUID(),
  validateRequest,
  userController.deleteUser
);

// User statistics (admin only)
router.get('/stats/summary',
  adminOnly,
  userController.getUserStats
);

export { router as userRouter };