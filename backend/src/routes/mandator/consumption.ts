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

const addReadingSchema = z.object({
  body: z.object({
    meterId: z.string().uuid(),
    value: z.number(),
    readingDate: z.string(),
    source: z.string().optional(),
  }),
});

/**
 * @swagger
 * /mandator/consumption/readings:
 *   post:
 *     tags: [Mandator - Consumption]
 *     summary: Add manual consumption reading
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - meterId
 *               - value
 *               - readingDate
 *             properties:
 *               meterId:
 *                 type: string
 *               value:
 *                 type: number
 *               readingDate:
 *                 type: string
 *                 format: date-time
 *               source:
 *                 type: string
 *                 enum: [manual, gateway, estimated]
 *     responses:
 *       201:
 *         description: Reading added successfully
 */
router.post(
  '/readings',
  validate(addReadingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { meterId, value, readingDate, source } = req.body;

    const meter = await prisma.meter.findFirst({
      where: { id: meterId, mandatorId },
    });

    if (!meter) {
      return sendError(res, 'Meter not found', 404);
    }

    const reading = await prisma.consumptionReading.create({
      data: {
        meterId,
        value,
        readingDate: new Date(readingDate),
        source: source || 'manual',
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'ADD_CONSUMPTION_READING',
      entityType: 'ConsumptionReading',
      entityId: reading.id,
      details: `Meter: ${meterId}, Value: ${value}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, reading, 'Reading added successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/consumption/readings:
 *   get:
 *     tags: [Mandator - Consumption]
 *     summary: List consumption readings
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: meterId
 *         schema:
 *           type: string
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
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
 *         description: List of readings
 */
router.get(
  '/readings',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const meterId = req.query.meterId as string;
    const unitId = req.query.unitId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (meterId) {
      where.meterId = meterId;
    } else if (unitId) {
      const meters = await prisma.meter.findMany({
        where: { unitId, mandatorId },
        select: { id: true },
      });
      where.meterId = { in: meters.map(m => m.id) };
    }

    if (startDate || endDate) {
      where.readingDate = {};
      if (startDate) where.readingDate.gte = new Date(startDate);
      if (endDate) where.readingDate.lte = new Date(endDate);
    }

    const [readings, total] = await Promise.all([
      prisma.consumptionReading.findMany({
        where,
        skip,
        take: limit,
        include: {
          meter: {
            select: {
              type: true,
              serialNumber: true,
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
          },
        },
        orderBy: { readingDate: 'desc' },
      }),
      prisma.consumptionReading.count({ where }),
    ]);

    sendPaginated(res, readings, page, limit, total);
  })
);

/**
 * @swagger
 * /mandator/consumption/summary:
 *   get:
 *     tags: [Mandator - Consumption]
 *     summary: Get consumption summary by unit or meter
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
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Consumption summary
 */
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const unitId = req.query.unitId as string;
    const buildingId = req.query.buildingId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let units: any[];

    if (unitId) {
      units = await prisma.unit.findMany({
        where: { id: unitId, mandatorId },
        include: { meters: true },
      });
    } else if (buildingId) {
      units = await prisma.unit.findMany({
        where: { buildingId, mandatorId },
        include: { meters: true },
      });
    } else {
      units = await prisma.unit.findMany({
        where: { mandatorId },
        include: { meters: true },
        take: 100, // Limit for performance
      });
    }

    const summary = await Promise.all(
      units.map(async (unit) => {
        const meterSummaries = await Promise.all(
          unit.meters.map(async (meter: any) => {
            const where: any = { meterId: meter.id };
            if (startDate || endDate) {
              where.readingDate = {};
              if (startDate) where.readingDate.gte = new Date(startDate);
              if (endDate) where.readingDate.lte = new Date(endDate);
            }

            const readings = await prisma.consumptionReading.findMany({
              where,
              orderBy: { readingDate: 'asc' },
            });

            const total = readings.length > 0
              ? readings[readings.length - 1].value - readings[0].value
              : 0;

            return {
              meterType: meter.type,
              serialNumber: meter.serialNumber,
              readingsCount: readings.length,
              totalConsumption: total,
              firstReading: readings[0]?.value || 0,
              lastReading: readings[readings.length - 1]?.value || 0,
            };
          })
        );

        return {
          unitNumber: unit.unitNumber,
          unitId: unit.id,
          meters: meterSummaries,
        };
      })
    );

    sendSuccess(res, summary);
  })
);

/**
 * @swagger
 * /mandator/consumption/export:
 *   get:
 *     tags: [Mandator - Consumption]
 *     summary: Export consumption data for billing
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exported consumption data
 */
router.get(
  '/export',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      return sendError(res, 'Start date and end date are required', 400);
    }

    const units = await prisma.unit.findMany({
      where: { mandatorId },
      include: {
        building: {
          select: {
            name: true,
            address: true,
          },
        },
        meters: {
          include: {
            readings: {
              where: {
                readingDate: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              },
              orderBy: { readingDate: 'asc' },
            },
          },
        },
        leases: {
          where: {
            OR: [
              {
                startDate: { lte: new Date(endDate) },
                endDate: { gte: new Date(startDate) },
              },
              {
                startDate: { lte: new Date(endDate) },
                endDate: null,
              },
            ],
          },
          include: {
            tenant: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const exportData = units.map((unit) => ({
      building: unit.building.name,
      unitNumber: unit.unitNumber,
      tenant: unit.leases[0]?.tenant || null,
      consumptionData: unit.meters.map((meter: any) => ({
        type: meter.type,
        serialNumber: meter.serialNumber,
        readings: meter.readings,
        consumption:
          meter.readings.length > 1
            ? meter.readings[meter.readings.length - 1].value - meter.readings[0].value
            : 0,
      })),
    }));

    sendSuccess(res, { startDate, endDate, data: exportData });
  })
);

/**
 * @swagger
 * /mandator/consumption/plausibility:
 *   get:
 *     tags: [Mandator - Consumption]
 *     summary: Check consumption plausibility against main meters
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: buildingId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plausibility check results
 */
router.get(
  '/plausibility',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const buildingId = req.query.buildingId as string;
    const date = req.query.date as string;

    if (!buildingId || !date) {
      return sendError(res, 'Building ID and date are required', 400);
    }

    const mainMeters = await prisma.mainMeter.findMany({
      where: { buildingId, mandatorId },
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
    });

    const results = await Promise.all(
      mainMeters.map(async (mainMeter) => {
        const unitMeters = await prisma.meter.findMany({
          where: {
            unit: { buildingId },
            type: mainMeter.type,
          },
          include: {
            readings: {
              where: {
                readingDate: {
                  gte: new Date(date),
                  lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)),
                },
              },
            },
            unit: {
              select: {
                unitNumber: true,
              },
            },
          },
        });

        const unitSum = unitMeters.reduce(
          (sum, meter) =>
            sum + (meter.readings[0]?.value || 0),
          0
        );

        const mainReading = mainMeter.readings[0]?.reading || 0;
        const difference = mainReading - unitSum;
        const percentageDiff = mainReading > 0 ? (difference / mainReading) * 100 : 0;

        return {
          meterType: mainMeter.type,
          mainMeterReading: mainReading,
          unitMeterSum: unitSum,
          difference,
          percentageDifference: percentageDiff.toFixed(2),
          isPlausible: Math.abs(percentageDiff) <= 10,
          unitBreakdown: unitMeters.map(meter => ({
            unitNumber: meter.unit.unitNumber,
            reading: meter.readings[0]?.value || 0,
          })),
        };
      })
    );

    sendSuccess(res, { date, buildingId, results });
  })
);

export default router;
