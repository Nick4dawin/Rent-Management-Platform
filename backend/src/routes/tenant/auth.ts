import { Router } from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendError } from '../../utils/response';
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, generateSMSCode, getSMSCodeExpiry, verifyRefreshToken } from '../../utils/auth';
import prisma from '../../config/database';
import { createAuditLog } from '../../utils/audit';
import { sendVerificationSMS } from '../../utils/sms';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().min(1),
    leaseId: z.string().uuid(),
    agreedToTerms: z.boolean().refine(val => val === true, 'Must agree to terms'),
    agreedToPrivacy: z.boolean().refine(val => val === true, 'Must agree to privacy policy'),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const verifySMSSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code: z.string().length(6),
  }),
});

/**
 * @swagger
 * /tenant/auth/register:
 *   post:
 *     tags: [Tenant - Authentication]
 *     summary: Tenant registration with consent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - phone
 *               - leaseId
 *               - agreedToTerms
 *               - agreedToPrivacy
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               leaseId:
 *                 type: string
 *               agreedToTerms:
 *                 type: boolean
 *               agreedToPrivacy:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Registration successful, SMS verification required
 */
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, firstName, lastName, phone, leaseId, agreedToTerms, agreedToPrivacy } = req.body;

    // Check if email already exists
    const existing = await prisma.tenant.findUnique({ where: { email } });
    if (existing) {
      return sendError(res, 'Email already registered', 400);
    }

    // Verify lease exists
    const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
    if (!lease) {
      return sendError(res, 'Invalid lease', 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate SMS verification code
    const smsCode = generateSMSCode();
    const smsCodeExpiry = getSMSCodeExpiry();

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        mandatorId: lease.mandatorId,
        smsCode,
        smsCodeExpiry,
        isVerified: false,
      },
    });

    // Create consents
    await prisma.consent.createMany({
      data: [
        {
          tenantId: tenant.id,
          type: 'TERMS_AND_CONDITIONS',
          version: '1.0',
          agreed: agreedToTerms,
          ipAddress: req.ip,
        },
        {
          tenantId: tenant.id,
          type: 'PRIVACY_POLICY',
          version: '1.0',
          agreed: agreedToPrivacy,
          ipAddress: req.ip,
        },
      ],
    });

    // Send SMS verification
    await sendVerificationSMS(phone, smsCode);

    sendSuccess(res, {
      message: 'Registration successful. Please verify your phone number.',
      email: tenant.email,
    }, 'Registration successful', 201);
  })
);

/**
 * @swagger
 * /tenant/auth/verify-sms:
 *   post:
 *     tags: [Tenant - Authentication]
 *     summary: Verify SMS code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification successful
 */
router.post(
  '/verify-sms',
  validate(verifySMSSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, code } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { email } });
    if (!tenant) {
      return sendError(res, 'Invalid credentials', 401);
    }

    if (tenant.isVerified) {
      return sendError(res, 'Account already verified', 400);
    }

    if (!tenant.smsCode || !tenant.smsCodeExpiry) {
      return sendError(res, 'No verification code found', 400);
    }

    if (new Date() > tenant.smsCodeExpiry) {
      return sendError(res, 'Verification code expired', 400);
    }

    if (tenant.smsCode !== code) {
      return sendError(res, 'Invalid verification code', 401);
    }

    // Mark as verified
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        isVerified: true,
        smsCode: null,
        smsCodeExpiry: null,
      },
    });

    sendSuccess(res, null, 'Verification successful');
  })
);

/**
 * @swagger
 * /tenant/auth/login:
 *   post:
 *     tags: [Tenant - Authentication]
 *     summary: Tenant login
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

    const tenant = await prisma.tenant.findUnique({ where: { email } });
    if (!tenant || !tenant.isActive) {
      return sendError(res, 'Invalid credentials', 401);
    }

    if (!tenant.isVerified) {
      return sendError(res, 'Please verify your account first', 401);
    }

    const isValid = await comparePassword(password, tenant.password);
    if (!isValid) {
      return sendError(res, 'Invalid credentials', 401);
    }

    const payload = {
      userId: tenant.id,
      userType: 'tenant' as const,
      mandatorId: tenant.mandatorId,
      email: tenant.email,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await createAuditLog({
      mandatorId: tenant.mandatorId,
      userId: tenant.id,
      userType: 'tenant',
      action: 'LOGIN',
      entityType: 'Tenant',
      entityId: tenant.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id: tenant.id,
        email: tenant.email,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
      },
    });
  })
);

/**
 * @swagger
 * /tenant/auth/refresh:
 *   post:
 *     tags: [Tenant - Authentication]
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
      const tenant = await prisma.tenant.findUnique({
        where: { id: decoded.userId },
      });

      if (!tenant) {
        return sendError(res, 'Tenant not found', 404);
      }

      const newPayload = {
        userId: tenant.id,
        userType: 'tenant' as const,
        mandatorId: tenant.mandatorId,
        email: tenant.email,
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
 * /tenant/auth/resend-sms:
 *   post:
 *     tags: [Tenant - Authentication]
 *     summary: Resend SMS verification code
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
 *         description: SMS code resent
 */
router.post(
  '/resend-sms',
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const tenant = await prisma.tenant.findUnique({
      where: { email },
    });

    if (!tenant) {
      return sendError(res, 'Tenant not found', 404);
    }

    if (tenant.isVerified) {
      return sendError(res, 'Tenant already verified', 400);
    }

    const smsCode = generateSMSCode();
    const smsCodeExpiry = getSMSCodeExpiry();

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        smsCode,
        smsCodeExpiry,
      },
    });

    await sendVerificationSMS(tenant.phone, smsCode);

    sendSuccess(res, { message: 'SMS code resent successfully' });
  })
);

/**
 * @swagger
 * /tenant/auth/logout:
 *   post:
 *     tags: [Tenant - Authentication]
 *     summary: Logout (invalidate token)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // With JWT, logout is handled client-side by removing the token
    // Optional: Implement token blacklist in Redis for added security
    
    await createAuditLog({
      mandatorId: req.user!.mandatorId!,
      userId: req.user!.userId,
      userType: 'tenant',
      action: 'LOGOUT',
      entityType: 'Tenant',
      entityId: req.user!.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, null, 'Logged out successfully');
  })
);

export default router;
