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

const createMainMeterSchema = z.object({
  body: z.object({
    buildingId: z.string().uuid(),
    type: z.enum(['WATER_HOT', 'WATER_COLD', 'HEAT', 'ELECTRICITY', 'GAS']),
    serialNumber: z.string().min(1),
    description: z.string().optional(),
  }),
});

const addReadingSchema = z.object({
  body: z.object({
    reading: z.number(),
    readingDate: z.string(),
    notes: z.string().optional(),
  }),
});

/**
 * @swagger
 * /mandator/main-meters:
 *   post:
 *     tags: [Mandator - Main Meters]
 *     summary: Create main meter for building
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
 *               - type
 *               - serialNumber
 *             properties:
 *               buildingId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [WATER_HOT, WATER_COLD, HEAT, ELECTRICITY, GAS]
 *               serialNumber:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Main meter created successfully
 */
router.post(
  '/',
  validate(createMainMeterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { buildingId, type, serialNumber, description } = req.body;

    const building = await prisma.building.findFirst({
      where: { id: buildingId, mandatorId },
    });

    if (!building) {
      return sendError(res, 'Building not found', 404);
    }

    const existing = await prisma.mainMeter.findUnique({
      where: { serialNumber },
    });

    if (existing) {
      return sendError(res, 'Main meter with this serial number already exists', 400);
    }

    const mainMeter = await prisma.mainMeter.create({
      data: {
        buildingId,
        mandatorId,
        type,
        serialNumber,
        description,
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_MAIN_METER',
      entityType: 'MainMeter',
      entityId: mainMeter.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, mainMeter, 'Main meter created successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/main-meters:
 *   get:
 *     tags: [Mandator - Main Meters]
 *     summary: List all main meters
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
 *         description: List of main meters
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
    if (buildingId) where.buildingId = buildingId;

    const [mainMeters, total] = await Promise.all([
      prisma.mainMeter.findMany({
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
          readings: {
            take: 1,
            orderBy: { readingDate: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.mainMeter.count({ where }),
    ]);

    sendPaginated(res, mainMeters, page, limit, total);
  })
);

/**
 * @swagger
 * /mandator/main-meters/{id}:
 *   get:
 *     tags: [Mandator - Main Meters]
 *     summary: Get main meter details
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
 *         description: Main meter details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const mainMeter = await prisma.mainMeter.findFirst({
      where: { id: req.params.id, mandatorId },
      include: {
        building: true,
        readings: {
          orderBy: { readingDate: 'desc' },
        },
      },
    });

    if (!mainMeter) {
      return sendError(res, 'Main meter not found', 404);
    }

    sendSuccess(res, mainMeter);
  })
);

/**
 * @swagger
 * /mandator/main-meters/{id}/readings:
 *   post:
 *     tags: [Mandator - Main Meters]
 *     summary: Add reading to main meter
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reading
 *               - readingDate
 *             properties:
 *               reading:
 *                 type: number
 *               readingDate:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reading added successfully
 */
router.post(
  '/:id/readings',
  validate(addReadingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { id } = req.params;
    const { reading, readingDate, notes } = req.body;

    const mainMeter = await prisma.mainMeter.findFirst({
      where: { id, mandatorId },
    });

    if (!mainMeter) {
      return sendError(res, 'Main meter not found', 404);
    }

    const meterReading = await prisma.mainMeterReading.create({
      data: {
        mainMeterId: id,
        reading,
        readingDate: new Date(readingDate),
        notes,
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'ADD_MAIN_METER_READING',
      entityType: 'MainMeterReading',
      entityId: meterReading.id,
      details: `Reading: ${reading}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, meterReading, 'Reading added successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/main-meters/{id}/readings:
 *   get:
 *     tags: [Mandator - Main Meters]
 *     summary: Get readings history for main meter
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Readings history
 */
router.get(
  '/:id/readings',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { id } = req.params;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const mainMeter = await prisma.mainMeter.findFirst({
      where: { id, mandatorId },
    });

    if (!mainMeter) {
      return sendError(res, 'Main meter not found', 404);
    }

    const where: any = { mainMeterId: id };
    if (startDate || endDate) {
      where.readingDate = {};
      if (startDate) where.readingDate.gte = new Date(startDate);
      if (endDate) where.readingDate.lte = new Date(endDate);
    }

    const readings = await prisma.mainMeterReading.findMany({
      where,
      orderBy: { readingDate: 'desc' },
    });

    sendSuccess(res, readings);
  })
);

/**
 * @swagger
 * /mandator/main-meters/{id}/plausibility:
 *   get:
 *     tags: [Mandator - Main Meters]
 *     summary: Check plausibility against unit meter sum
 *     description: Compare main meter reading against sum of all unit meters for the building
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Plausibility check results
 */
router.get(
  '/:id/plausibility',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { id } = req.params;
    const date = req.query.date as string;

    if (!date) {
      return sendError(res, 'Date parameter is required', 400);
    }

    const mainMeter = await prisma.mainMeter.findFirst({
      where: { id, mandatorId },
      include: { building: true },
    });

    if (!mainMeter) {
      return sendError(res, 'Main meter not found', 404);
    }

    // Get main meter reading for the date
    const mainReading = await prisma.mainMeterReading.findFirst({
      where: {
        mainMeterId: id,
        readingDate: {
          gte: new Date(date),
          lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)),
        },
      },
    });

    if (!mainReading) {
      return sendError(res, 'No main meter reading found for this date', 404);
    }

    // Get all unit meters of same type in the building
    const units = await prisma.unit.findMany({
      where: { buildingId: mainMeter.buildingId },
      include: {
        meters: {
          where: { type: mainMeter.type },
          include: {
            readings: {
              where: {
                readingDate: {
                  gte: new Date(date),
                  lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)),
                },
              },
            },
          },
        },
      },
    });

    // Calculate sum of unit meter readings
    let unitSum = 0;
    const unitReadings: any[] = [];

    units.forEach(unit => {
      unit.meters.forEach(meter => {
        meter.readings.forEach(reading => {
          unitSum += reading.value;
          unitReadings.push({
            unitNumber: unit.unitNumber,
            meterId: meter.id,
            reading: reading.value,
          });
        });
      });
    });

    const difference = mainReading.reading - unitSum;
    const percentageDiff = mainReading.reading > 0 ? (difference / mainReading.reading) * 100 : 0;
    const isPlausible = Math.abs(percentageDiff) <= 10; // 10% threshold

    const result = {
      mainMeterReading: mainReading.reading,
      unitMeterSum: unitSum,
      difference,
      percentageDifference: percentageDiff.toFixed(2),
      isPlausible,
      threshold: '±10%',
      unitReadings,
      date,
    };

    sendSuccess(res, result);
  })
);

export default router;
