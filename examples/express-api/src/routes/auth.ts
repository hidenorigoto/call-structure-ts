import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/authController';
import { validateRequest } from '../middleware/validateRequest';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Register new user
router.post('/register',
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)/),
  validateRequest,
  authController.register
);

// Login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validateRequest,
  authController.login
);

// Refresh token
router.post('/refresh',
  body('refreshToken').notEmpty(),
  validateRequest,
  authController.refreshToken
);

// Logout
router.post('/logout',
  authMiddleware,
  authController.logout
);

// Forgot password
router.post('/forgot-password',
  body('email').isEmail().normalizeEmail(),
  validateRequest,
  authController.forgotPassword
);

// Reset password
router.post('/reset-password',
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)/),
  validateRequest,
  authController.resetPassword
);

// Verify email
router.post('/verify-email',
  body('token').notEmpty(),
  validateRequest,
  authController.verifyEmail
);

// Get current session
router.get('/session',
  authMiddleware,
  authController.getCurrentSession
);

export { router as authRouter };