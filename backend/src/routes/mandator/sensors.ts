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

const createSensorSchema = z.object({
  body: z.object({
    unitId: z.string().uuid(),
    type: z.enum(['DOOR', 'WINDOW', 'THERMOSTAT', 'SMOKE_DETECTOR']),
    serialNumber: z.string().min(1),
    manufacturer: z.string().optional(),
    protocol: z.string().optional(),
  }),
});

/**
 * @swagger
 * /mandator/sensors:
 *   post:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: Add sensor to unit
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
 *                 enum: [DOOR, WINDOW, THERMOSTAT, SMOKE_DETECTOR]
 *               serialNumber:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               protocol:
 *                 type: string
 *                 description: e.g., ZigBee
 *     responses:
 *       201:
 *         description: Sensor added successfully
 */
router.post(
  '/',
  validate(createSensorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { unitId, type, serialNumber, manufacturer, protocol } = req.body;

    const unit = await prisma.unit.findFirst({
      where: { id: unitId, mandatorId },
    });

    if (!unit) {
      return sendError(res, 'Unit not found', 404);
    }

    const existing = await prisma.sensor.findUnique({
      where: { serialNumber },
    });

    if (existing) {
      return sendError(res, 'Sensor with this serial number already exists', 400);
    }

    const sensor = await prisma.sensor.create({
      data: {
        unitId,
        mandatorId,
        type,
        serialNumber,
        manufacturer,
        protocol,
        isActive: true,
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_SENSOR',
      entityType: 'Sensor',
      entityId: sensor.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, sensor, 'Sensor added successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/sensors:
 *   get:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: List all sensors
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
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
 *         description: List of sensors
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const unitId = req.query.unitId as string;
    const type = req.query.type as string;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const where: any = { mandatorId };
    if (unitId) where.unitId = unitId;
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;

    const [sensors, total] = await Promise.all([
      prisma.sensor.findMany({
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
      prisma.sensor.count({ where }),
    ]);

    sendPaginated(res, sensors, page, limit, total);
  })
);

/**
 * @swagger
 * /mandator/sensors/{id}:
 *   get:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: Get sensor details
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
 *         description: Sensor details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const sensor = await prisma.sensor.findFirst({
      where: { id: req.params.id, mandatorId },
      include: {
        unit: {
          include: {
            building: true,
          },
        },
        alarmEvents: {
          take: 10,
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!sensor) {
      return sendError(res, 'Sensor not found', 404);
    }

    sendSuccess(res, sensor);
  })
);

/**
 * @swagger
 * /mandator/sensors/{id}:
 *   put:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: Update sensor
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
 *         description: Sensor updated successfully
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { manufacturer, protocol } = req.body;

    const existing = await prisma.sensor.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!existing) {
      return sendError(res, 'Sensor not found', 404);
    }

    const sensor = await prisma.sensor.update({
      where: { id: req.params.id },
      data: { manufacturer, protocol },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'UPDATE_SENSOR',
      entityType: 'Sensor',
      entityId: sensor.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, sensor, 'Sensor updated successfully');
  })
);

/**
 * @swagger
 * /mandator/sensors/{id}/activate:
 *   patch:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: Activate sensor
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
 *         description: Sensor activated
 */
router.patch(
  '/:id/activate',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const sensor = await prisma.sensor.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!sensor) {
      return sendError(res, 'Sensor not found', 404);
    }

    const updated = await prisma.sensor.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'ACTIVATE_SENSOR',
      entityType: 'Sensor',
      entityId: sensor.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, updated, 'Sensor activated successfully');
  })
);

/**
 * @swagger
 * /mandator/sensors/{id}/deactivate:
 *   patch:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: Deactivate sensor
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
 *         description: Sensor deactivated
 */
router.patch(
  '/:id/deactivate',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const sensor = await prisma.sensor.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!sensor) {
      return sendError(res, 'Sensor not found', 404);
    }

    const updated = await prisma.sensor.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'DEACTIVATE_SENSOR',
      entityType: 'Sensor',
      entityId: sensor.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, updated, 'Sensor deactivated successfully');
  })
);

/**
 * @swagger
 * /mandator/sensors/{id}:
 *   delete:
 *     tags: [Mandator - Meters & Sensors]
 *     summary: Delete sensor
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
 *         description: Sensor deleted successfully
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const sensor = await prisma.sensor.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!sensor) {
      return sendError(res, 'Sensor not found', 404);
    }

    await prisma.sensor.delete({ where: { id: req.params.id } });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'DELETE_SENSOR',
      entityType: 'Sensor',
      entityId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, null, 'Sensor deleted successfully');
  })
);

export default router;
