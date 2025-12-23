import { Router } from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendError } from '../../utils/response';
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken } from '../../utils/auth';
import prisma from '../../config/database';
import { createAuditLog } from '../../utils/audit';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

/**
 * @swagger
 * /super-admin/auth/login:
 *   post:
 *     tags: [Super Admin - Authentication]
 *     summary: Super admin login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       type: object
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Find super admin
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email },
    });

    if (!superAdmin || !superAdmin.isActive) {
      return sendError(res, 'Invalid credentials', 401);
    }

    // Verify password
    const isValidPassword = await comparePassword(password, superAdmin.password);
    if (!isValidPassword) {
      return sendError(res, 'Invalid credentials', 401);
    }

    // Generate tokens
    const payload = {
      userId: superAdmin.id,
      userType: 'super-admin' as const,
      email: superAdmin.email,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Log audit
    await createAuditLog({
      userId: superAdmin.id,
      userType: 'super-admin',
      action: 'LOGIN',
      entityType: 'SuperAdmin',
      entityId: superAdmin.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
      },
    }, 'Login successful');
  })
);

/**
 * @swagger
 * /super-admin/auth/logout:
 *   post:
 *     tags: [Super Admin - Authentication]
 *     summary: Super admin logout
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    // In a stateless JWT system, logout is handled client-side
    // Here we just acknowledge the request
    sendSuccess(res, null, 'Logout successful');
  })
);

/**
 * @swagger
 * /super-admin/auth/refresh:
 *   post:
 *     tags: [Super Admin - Authentication]
 *     summary: Refresh access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required', 400);
    }

    try {
      const decoded = verifyToken(refreshToken);
      const superAdmin = await prisma.superAdmin.findUnique({
        where: { id: decoded.userId },
      });

      if (!superAdmin) {
        return sendError(res, 'Super admin not found', 404);
      }

      const newAccessToken = generateAccessToken(superAdmin.id, 'super-admin');

      sendSuccess(res, { accessToken: newAccessToken });
    } catch (error) {
      return sendError(res, 'Invalid refresh token', 401);
    }
  })
);

export default router;
