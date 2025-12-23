import { Router } from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authenticate, authorize, enforceDataIsolation } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';
import prisma from '../../config/database';
import { createAuditLog } from '../../utils/audit';

const router = Router();

router.use(authenticate);
router.use(authorize('mandator'));
router.use(enforceDataIsolation);

const createBuildingSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    yearBuilt: z.number().optional(),
    hasGasHeating: z.boolean().optional(),
  }),
});

/**
 * @swagger
 * /mandator/buildings:
 *   post:
 *     tags: [Mandator - Buildings]
 *     summary: Create building
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *               - city
 *               - postalCode
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               yearBuilt:
 *                 type: integer
 *               hasGasHeating:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Building created
 */
router.post(
  '/',
  validate(createBuildingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const building = await prisma.building.create({
      data: {
        ...req.body,
        mandatorId,
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_BUILDING',
      entityType: 'Building',
      entityId: building.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, building, 'Building created successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/buildings:
 *   get:
 *     tags: [Mandator - Buildings]
 *     summary: List all buildings
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
 *     responses:
 *       200:
 *         description: List of buildings
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [buildings, total] = await Promise.all([
      prisma.building.findMany({
        where: { mandatorId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.building.count({ where: { mandatorId } }),
    ]);

    sendPaginated(res, buildings, page, limit, total);
  })
);

/**
 * @swagger
 * /mandator/buildings/{id}:
 *   get:
 *     tags: [Mandator - Buildings]
 *     summary: Get building by ID
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
 *         description: Building details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const building = await prisma.building.findFirst({
      where: {
        id: req.params.id,
        mandatorId,
      },
      include: {
        units: {
          select: {
            id: true,
            unitNumber: true,
            floor: true,
            isOccupied: true,
          },
        },
      },
    });

    if (!building) {
      return sendError(res, 'Building not found', 404);
    }

    sendSuccess(res, building);
  })
);

export default router;
