import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendError } from '../../utils/response';
import prisma from '../../config/database';

const router = Router();

router.use(authenticate);
router.use(authorize('tenant'));

/**
 * @swagger
 * /tenant/consumption:
 *   get:
 *     tags: [Tenant - Consumption]
 *     summary: Get consumption overview dashboard
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Consumption overview
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const lease = await prisma.lease.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'SIGNED_BOTH'] },
      },
      include: {
        unit: {
          include: {
            meters: {
              include: {
                readings: {
                  orderBy: { readingDate: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!lease) {
      return sendError(res, 'No active lease found', 404);
    }

    const overview = lease.unit.meters.map((meter: any) => ({
      type: meter.type,
      serialNumber: meter.serialNumber,
      lastReading: meter.readings[0] || null,
    }));

    sendSuccess(res, overview);
  })
);

/**
 * @swagger
 * /tenant/consumption/water:
 *   get:
 *     tags: [Tenant - Consumption]
 *     summary: Get water consumption history
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Water consumption data
 */
router.get(
  '/water',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;
    const months = parseInt(req.query.months as string) || 12;

    const lease = await prisma.lease.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'SIGNED_BOTH'] },
      },
    });

    if (!lease) {
      return sendError(res, 'No active lease found', 404);
    }

    const meters = await prisma.meter.findMany({
      where: {
        unitId: lease.unitId,
        type: { in: ['WATER_HOT', 'WATER_COLD'] },
      },
      include: {
        readings: {
          where: {
            readingDate: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - months)),
            },
          },
          orderBy: { readingDate: 'asc' },
        },
      },
    });

    sendSuccess(res, meters);
  })
);

/**
 * @swagger
 * /tenant/consumption/heat:
 *   get:
 *     tags: [Tenant - Consumption]
 *     summary: Get heat consumption history
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Heat consumption data
 */
router.get(
  '/heat',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;
    const months = parseInt(req.query.months as string) || 12;

    const lease = await prisma.lease.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'SIGNED_BOTH'] },
      },
    });

    if (!lease) {
      return sendError(res, 'No active lease found', 404);
    }

    const meters = await prisma.meter.findMany({
      where: {
        unitId: lease.unitId,
        type: 'HEAT',
      },
      include: {
        readings: {
          where: {
            readingDate: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - months)),
            },
          },
          orderBy: { readingDate: 'asc' },
        },
      },
    });

    sendSuccess(res, meters);
  })
);

/**
 * @swagger
 * /tenant/consumption/electricity:
 *   get:
 *     tags: [Tenant - Consumption]
 *     summary: Get electricity consumption history
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Electricity consumption data
 */
router.get(
  '/electricity',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;
    const months = parseInt(req.query.months as string) || 12;

    const lease = await prisma.lease.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'SIGNED_BOTH'] },
      },
    });

    if (!lease) {
      return sendError(res, 'No active lease found', 404);
    }

    const meters = await prisma.meter.findMany({
      where: {
        unitId: lease.unitId,
        type: 'ELECTRICITY',
      },
      include: {
        readings: {
          where: {
            readingDate: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - months)),
            },
          },
          orderBy: { readingDate: 'asc' },
        },
      },
    });

    sendSuccess(res, meters);
  })
);

export default router;
