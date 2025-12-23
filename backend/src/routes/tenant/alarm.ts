import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendError } from '../../utils/response';
import prisma from '../../config/database';
import { createAuditLog } from '../../utils/audit';

const router = Router();

router.use(authenticate);
router.use(authorize('tenant'));

/**
 * @swagger
 * /tenant/alarm/status:
 *   get:
 *     tags: [Tenant - Alarm System]
 *     summary: Get current alarm system status
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Alarm status
 */
router.get(
  '/status',
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
            sensors: {
              where: { type: { in: ['DOOR', 'WINDOW'] } },
            },
          },
        },
      },
    });

    if (!lease) {
      return sendError(res, 'No active lease found', 404);
    }

    // Get latest alarm event
    const latestEvent = await prisma.alarmEvent.findFirst({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
    });

    const status = {
      isArmed: latestEvent?.eventType === 'ARMED',
      lastEvent: latestEvent,
      sensors: lease.unit.sensors.map((sensor: any) => ({
        id: sensor.id,
        type: sensor.type,
        isActive: sensor.isActive,
      })),
    };

    sendSuccess(res, status);
  })
);

/**
 * @swagger
 * /tenant/alarm/arm:
 *   post:
 *     tags: [Tenant - Alarm System]
 *     summary: Arm the alarm system
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Alarm armed successfully
 */
router.post(
  '/arm',
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
            sensors: {
              where: { type: { in: ['DOOR', 'WINDOW'] }, isActive: true },
            },
          },
        },
      },
    });

    if (!lease) {
      return sendError(res, 'No active lease found', 404);
    }

    // Create alarm event for each sensor
    const events = await Promise.all(
      lease.unit.sensors.map((sensor: any) =>
        prisma.alarmEvent.create({
          data: {
            sensorId: sensor.id,
            tenantId,
            eventType: 'ARMED',
          },
        })
      )
    );

    await createAuditLog({
      mandatorId: req.user!.mandatorId!,
      userId: tenantId,
      userType: 'tenant',
      action: 'ARM_ALARM',
      entityType: 'AlarmEvent',
      entityId: events[0]?.id || '',
      details: 'Alarm system armed',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, { message: 'Alarm armed successfully', sensors: lease.unit.sensors.length });
  })
);

/**
 * @swagger
 * /tenant/alarm/disarm:
 *   post:
 *     tags: [Tenant - Alarm System]
 *     summary: Disarm the alarm system
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Alarm disarmed successfully
 */
router.post(
  '/disarm',
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
            sensors: {
              where: { type: { in: ['DOOR', 'WINDOW'] }, isActive: true },
            },
          },
        },
      },
    });

    if (!lease) {
      return sendError(res, 'No active lease found', 404);
    }

    const events = await Promise.all(
      lease.unit.sensors.map((sensor: any) =>
        prisma.alarmEvent.create({
          data: {
            sensorId: sensor.id,
            tenantId,
            eventType: 'DISARMED',
          },
        })
      )
    );

    await createAuditLog({
      mandatorId: req.user!.mandatorId!,
      userId: tenantId,
      userType: 'tenant',
      action: 'DISARM_ALARM',
      entityType: 'AlarmEvent',
      entityId: events[0]?.id || '',
      details: 'Alarm system disarmed',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, { message: 'Alarm disarmed successfully' });
  })
);

/**
 * @swagger
 * /tenant/alarm/events:
 *   get:
 *     tags: [Tenant - Alarm System]
 *     summary: Get alarm event history
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Alarm event history
 */
router.get(
  '/events',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    const events = await prisma.alarmEvent.findMany({
      where: { tenantId },
      include: {
        sensor: {
          select: {
            type: true,
            serialNumber: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    sendSuccess(res, events);
  })
);

/**
 * @swagger
 * /tenant/alarm/sensors:
 *   get:
 *     tags: [Tenant - Alarm System]
 *     summary: List all alarm sensors in unit
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of sensors
 */
router.get(
  '/sensors',
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
            sensors: {
              where: { type: { in: ['DOOR', 'WINDOW', 'SMOKE_DETECTOR'] } },
            },
          },
        },
      },
    });

    if (!lease) {
      return sendError(res, 'No active lease found', 404);
    }

    sendSuccess(res, lease.unit.sensors);
  })
);

export default router;
