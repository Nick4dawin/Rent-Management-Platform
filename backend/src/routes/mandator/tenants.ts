import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, authorize, enforceDataIsolation } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendPaginated, sendError } from '../../utils/response';
import prisma from '../../config/database';
import { sendVerificationSMS } from '../../utils/sms';
import { generateSMSCode, getSMSCodeExpiry, hashPassword } from '../../utils/auth';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
 
const router = Router();
 
router.use(authenticate);
router.use(authorize('mandator'));
router.use(enforceDataIsolation);
 
const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().min(1),
    // leaseId: z.string().uuid(),
    agreedToTerms: z.boolean().refine(val => val === true, 'Must agree to terms'),
    agreedToPrivacy: z.boolean().refine(val => val === true, 'Must agree to privacy policy'),
  }),
});
 
/**
 * @swagger
 * /mandator/tenants/register:
 *   post:
 *     tags: [Mandator - Tenants]
 *     summary: Tenant registration with consent
 *     security:
 *       - BearerAuth: []
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
  authenticate,
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, firstName, lastName, phone, leaseId, agreedToTerms, agreedToPrivacy } = req.body;
    const mandatorId = req.user!.mandatorId!;
    // Check if email already exists
    const existing = await prisma.tenant.findUnique({ where: { email } });
    if (existing) {
      return sendError(res, 'Email already registered', 400);
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
        mandatorId: mandatorId,
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
 * /mandator/tenants:
 *   get:
 *     tags: [Mandator - Tenants]
 *     summary: List all tenants
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of tenants
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
 
    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where: { mandatorId },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tenant.count({ where: { mandatorId } }),
    ]);
 
    sendPaginated(res, tenants, page, limit, total);
  })
);
 
export default router;