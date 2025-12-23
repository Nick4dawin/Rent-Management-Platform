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

const createUnitSchema = z.object({
  body: z.object({
    buildingId: z.string().uuid(),
    unitNumber: z.string().min(1),
    floor: z.number().optional(),
    area: z.number().optional(),
    rooms: z.number().optional(),
    hasWlan: z.boolean().optional(),
    hasElectricity: z.boolean().optional(),
  }),
});

/**
 * @swagger
 * /mandator/units:
 *   post:
 *     tags: [Mandator - Units]
 *     summary: Create unit
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - buildingId
 *               - unitNumber
 *             properties:
 *               buildingId:
 *                 type: string
 *               unitNumber:
 *                 type: string
 *               floor:
 *                 type: integer
 *               area:
 *                 type: number
 *               rooms:
 *                 type: integer
 *               hasWlan:
 *                 type: boolean
 *               hasElectricity:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Unit created
 */
router.post(
  '/',
  validate(createUnitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { buildingId, ...unitData } = req.body;

    // Verify building belongs to mandator
    const building = await prisma.building.findFirst({
      where: { id: buildingId, mandatorId },
    });

    if (!building) {
      return sendError(res, 'Building not found', 404);
    }

    const unit = await prisma.unit.create({
      data: {
        ...unitData,
        buildingId,
        mandatorId,
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_UNIT',
      entityType: 'Unit',
      entityId: unit.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, unit, 'Unit created successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/units:
 *   get:
 *     tags: [Mandator - Units]
 *     summary: List all units
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: buildingId
 *         schema:
 *           type: string
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
 *         description: List of units
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const buildingId = req.query.buildingId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const where: any = { mandatorId };
    if (buildingId) {
      where.buildingId = buildingId;
    }

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        skip,
        take: limit,
        include: {
          building: {
            select: {
              name: true,
              address: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.unit.count({ where }),
    ]);

    sendPaginated(res, units, page, limit, total);
  })
);

export default router;
