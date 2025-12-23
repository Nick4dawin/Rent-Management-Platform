import { Router } from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendError } from '../../utils/response';
import { comparePassword, generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/auth';
import prisma from '../../config/database';
import { createAuditLog } from '../../utils/audit';
import logger from '../../config/logger';

const router = Router();

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

/**
 * @swagger
 * /mandator/auth/login:
 *   post:
 *     tags: [Mandator - Authentication]
 *     summary: Mandator login
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const mandator = await prisma.mandator.findFirst({
      where: { adminEmail: email },
    });

    if (!mandator || !mandator.isActive) {
      return sendError(res, 'Invalid credentials', 401);
    }

    const isValid = await comparePassword(password, mandator.adminPassword);
    if (!isValid) {
      return sendError(res, 'Invalid credentials', 401);
    }

    const payload = {
      userId: mandator.id,
      userType: 'mandator' as const,
      mandatorId: mandator.id,
      email: mandator.adminEmail,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await createAuditLog({
      mandatorId: mandator.id,
      userId: mandator.id,
      userType: 'mandator',
      action: 'LOGIN',
      entityType: 'Mandator',
      entityId: mandator.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id: mandator.id,
        email: mandator.adminEmail,
        companyName: mandator.companyName,
        firstName: mandator.adminFirstName,
        lastName: mandator.adminLastName,
      },
    });
  })
);

/**
 * @swagger
 * /mandator/auth/refresh:
 *   post:
 *     tags: [Mandator - Authentication]
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
      const decoded = verifyRefreshToken(refreshToken);
      const mandator = await prisma.mandator.findUnique({
        where: { id: decoded.userId },
      });

      if (!mandator || !mandator.isActive) {
        return sendError(res, 'Mandator not found or inactive', 404);
      }

      const newPayload = {
        userId: mandator.id,
        userType: 'mandator' as const,
        mandatorId: mandator.id,
        email: mandator.adminEmail,
      };
      const newAccessToken = generateAccessToken(newPayload);

      sendSuccess(res, { accessToken: newAccessToken });
    } catch (error) {
      return sendError(res, 'Invalid refresh token', 401);
    }
  })
);

/**
 * @swagger
 * /mandator/auth/forgot-password:
 *   post:
 *     tags: [Mandator - Authentication]
 *     summary: Request password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const mandator = await prisma.mandator.findFirst({
      where: { adminEmail: email },
    });

    if (!mandator) {
      // Don't reveal if email exists
      return sendSuccess(res, { message: 'If the email exists, a reset link has been sent' });
    }

    // Generate reset token (simplified - in production use proper token generation)
    const resetToken = Math.random().toString(36).substring(7);
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.mandator.update({
      where: { id: mandator.id },
      data: {
        // Note: These fields would need to be added to schema
        // resetToken,
        // resetTokenExpiry,
      },
    });

    // TODO: Send email with reset link
    logger.info(`Password reset requested for ${email}`);

    sendSuccess(res, { message: 'If the email exists, a reset link has been sent' });
  })
);

/**
 * @swagger
 * /mandator/auth/reset-password:
 *   post:
 *     tags: [Mandator - Authentication]
 *     summary: Reset password with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post(
  '/reset-password',
  asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    // In production, verify token against database
    // const mandator = await prisma.mandator.findFirst({
    //   where: {
    //     resetToken: token,
    //     resetTokenExpiry: { gte: new Date() },
    //   },
    // });

    // For now, return placeholder response
    sendSuccess(res, { message: 'Password reset functionality to be fully implemented' });
  })
);

export default router;
