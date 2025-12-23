import { Router } from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';
import { hashPassword } from '../../utils/auth';
import prisma from '../../config/database';
import { createAuditLog } from '../../utils/audit';

const router = Router();

// All mandator routes require super-admin authentication
router.use(authenticate);
router.use(authorize('super-admin'));

// Validation schemas
const createMandatorSchema = z.object({
  body: z.object({
    companyName: z.string().min(1, 'Company name is required'),
    contactEmail: z.string().email('Invalid email'),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    adminEmail: z.string().email('Admin email is required'),
    adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
    adminFirstName: z.string().optional(),
    adminLastName: z.string().optional(),
  }),
});

/**
 * @swagger
 * /super-admin/mandators:
 *   post:
 *     tags: [Super Admin - Mandators]
 *     summary: Create new mandator
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *               - contactEmail
 *               - adminEmail
 *               - adminPassword
 *             properties:
 *               companyName:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               adminEmail:
 *                 type: string
 *               adminPassword:
 *                 type: string
 *               adminFirstName:
 *                 type: string
 *               adminLastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Mandator created successfully
 */
router.post(
  '/',
  validate(createMandatorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = req.body;

    // Check if email already exists
    const existing = await prisma.mandator.findUnique({
      where: { contactEmail: data.contactEmail },
    });

    if (existing) {
      return sendError(res, 'Email already exists', 400);
    }

    // Hash admin password
    const hashedPassword = await hashPassword(data.adminPassword);

    // Create mandator
    const mandator = await prisma.mandator.create({
      data: {
        companyName: data.companyName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        adminEmail: data.adminEmail,
        adminPassword: hashedPassword,
        adminFirstName: data.adminFirstName,
        adminLastName: data.adminLastName,
        isActive: true,
      },
    });

    // Log audit
    if (req.user) {
      await createAuditLog({
        userId: req.user.userId,
        userType: 'super-admin',
        action: 'CREATE_MANDATOR',
        entityType: 'Mandator',
        entityId: mandator.id,
        details: `Created mandator: ${mandator.companyName}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    sendSuccess(res, mandator, 'Mandator created successfully', 201);
  })
);

/**
 * @swagger
 * /super-admin/mandators:
 *   get:
 *     tags: [Super Admin - Mandators]
 *     summary: Get all mandators
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of mandators
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { companyName: { contains: search, mode: 'insensitive' as const } },
        { contactEmail: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

    const [mandators, total] = await Promise.all([
      prisma.mandator.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          companyName: true,
          contactEmail: true,
          contactPhone: true,
          city: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.mandator.count({ where }),
    ]);

    sendPaginated(res, mandators, page, limit, total);
  })
);

/**
 * @swagger
 * /super-admin/mandators/{id}:
 *   get:
 *     tags: [Super Admin - Mandators]
 *     summary: Get mandator by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type:string
 *     responses:
 *       200:
 *         description: Mandator details
 *       404:
 *         description: Mandator not found
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const mandator = await prisma.mandator.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        city: true,
        postalCode: true,
        country: true,
        isActive: true,
        contractStartDate: true,
        contractEndDate: true,
        adminEmail: true,
        adminFirstName: true,
        adminLastName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!mandator) {
      return sendError(res, 'Mandator not found', 404);
    }

    sendSuccess(res, mandator);
  })
);

/**
 * @swagger
 * /super-admin/mandators/{id}/activate:
 *   patch:
 *     tags: [Super Admin - Mandators]
 *     summary: Activate mandator
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mandator activated
 */
router.patch(
  '/:id/activate',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const mandator = await prisma.mandator.update({
      where: { id },
      data: { isActive: true },
    });

    if (req.user) {
      await createAuditLog({
        userId: req.user.userId,
        userType: 'super-admin',
        action: 'ACTIVATE_MANDATOR',
        entityType: 'Mandator',
        entityId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    sendSuccess(res, mandator, 'Mandator activated successfully');
  })
);

/**
 * @swagger
 * /super-admin/mandators/{id}/deactivate:
 *   patch:
 *     tags: [Super Admin - Mandators]
 *     summary: Deactivate mandator
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mandator deactivated
 */
router.patch(
  '/:id/deactivate',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const mandator = await prisma.mandator.update({
      where: { id },
      data: { isActive: false },
    });

    if (req.user) {
      await createAuditLog({
        userId: req.user.userId,
        userType: 'super-admin',
        action: 'DEACTIVATE_MANDATOR',
        entityType: 'Mandator',
        entityId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    sendSuccess(res, mandator, 'Mandator deactivated successfully');
  })
);

export default router;
