import {Router } from 'express';
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

const createMeterSchema = z.object({
  body: z.object({
    unitId: z.string().uuid(),
    type: z.enum(['WATER_HOT', 'WATER_COLD', 'HEAT', 'ELECTRICITY', 'GAS']),
    serialNumber: z.string().min(1),
    manufacturer: z.string().optional(),
    installDate: z.string().optional(),
    protocol: z.string().optional(),
  }),
});

/**
 * @swagger
 * /mandator/meters:
 *   post:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: Add meter to unit
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - unitId
 *               - type
 *               - serialNumber
 *             properties:
 *               unitId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [WATER_HOT, WATER_COLD, HEAT, ELECTRICITY, GAS]
 *               serialNumber:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               installDate:
 *                 type: string
 *                 format: date
 *               protocol:
 *                 type: string
 *                 description: e.g., wM-Bus
 *     responses:
 *       201:
 *         description: Meter added successfully
 */
router.post(
  '/',
  validate(createMeterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { unitId, type, serialNumber, manufacturer, installDate, protocol } = req.body;

    // Verify unit belongs to mandator
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, mandatorId },
    });

    if (!unit) {
      return sendError(res, 'Unit not found', 404);
    }

    // Check for duplicate serial number
    const existing = await prisma.meter.findUnique({
      where: { serialNumber },
    });

    if (existing) {
      return sendError(res, 'Meter with this serial number already exists', 400);
    }

    const meter = await prisma.meter.create({
      data: {
        unitId,
        mandatorId,
        type,
        serialNumber,
        manufacturer,
        installDate: installDate ? new Date(installDate) : null,
        protocol,
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_METER',
      entityType: 'Meter',
      entityId: meter.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, meter, 'Meter added successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/meters:
 *   get:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: List all meters
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *       - in: query
 *         name: buildingId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
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
 *         description: List of meters
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const unitId = req.query.unitId as string;
    const buildingId = req.query.buildingId as string;
    const type = req.query.type as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const where: any = { mandatorId };
    if (unitId) where.unitId = unitId;
    if (type) where.type = type;
    if (buildingId) {
      where.unit = { buildingId };
    }

    const [meters, total] = await Promise.all([
      prisma.meter.findMany({
        where,
        skip,
        take: limit,
        include: {
          unit: {
            select: {
              unitNumber: true,
              building: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.meter.count({ where }),
    ]);

    sendPaginated(res, meters, page, limit, total);
  })
);

/**
 * @swagger
 * /mandator/meters/{id}:
 *   get:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: Get meter details
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
 *         description: Meter details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const meter = await prisma.meter.findFirst({
      where: { id: req.params.id, mandatorId },
      include: {
        unit: {
          include: {
            building: true,
          },
        },
        readings: {
          take: 10,
          orderBy: { readingDate: 'desc' },
        },
      },
    });

    if (!meter) {
      return sendError(res, 'Meter not found', 404);
    }

    sendSuccess(res, meter);
  })
);

/**
 * @swagger
 * /mandator/meters/{id}:
 *   put:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: Update meter
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               manufacturer:
 *                 type: string
 *               protocol:
 *                 type: string
 *     responses:
 *       200:
 *         description: Meter updated successfully
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { manufacturer, protocol } = req.body;

    const existing = await prisma.meter.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!existing) {
      return sendError(res, 'Meter not found', 404);
    }

    const meter = await prisma.meter.update({
      where: { id: req.params.id },
      data: { manufacturer, protocol },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'UPDATE_METER',
      entityType: 'Meter',
      entityId: meter.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, meter, 'Meter updated successfully');
  })
);

/**
 * @swagger
 * /mandator/meters/{id}:
 *   delete:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: Delete meter
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
 *         description: Meter deleted successfully
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const meter = await prisma.meter.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!meter) {
      return sendError(res, 'Meter not found', 404);
    }

    await prisma.meter.delete({ where: { id: req.params.id } });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'DELETE_METER',
      entityType: 'Meter',
      entityId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, null, 'Meter deleted successfully');
  })
);

export default router;
