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

const createWlanSchema = z.object({
  body: z.object({
    unitId: z.string().uuid(),
    ssid: z.string().min(1),
    password: z.string().min(8),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
  }),
});

/**
 * @swagger
 * /mandator/wlan:
 *   post:
 *     tags: [Mandator - WLAN]
 *     summary: Create WLAN credentials for unit
 *     description: Automated provisioning after move-in protocol signing
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
 *               - ssid
 *               - password
 *             properties:
 *               unitId:
 *                 type: string
 *               ssid:
 *                 type: string
 *               password:
 *                 type: string
 *                 minimum: 8
 *               validFrom:
 *                 type: string
 *                 format: date-time
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: WLAN credentials created
 */
router.post(
  '/',
  validate(createWlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { unitId, ssid, password, validFrom, validUntil } = req.body;

    const unit = await prisma.unit.findFirst({
      where: { id: unitId, mandatorId },
    });

    if (!unit) {
      return sendError(res, 'Unit not found', 404);
    }

    if (!unit.hasWlan) {
      return sendError(res, 'WLAN is not enabled for this unit', 400);
    }

    const existing = await prisma.wlanCredential.findUnique({
      where: { unitId },
    });

    if (existing) {
      return sendError(res, 'WLAN credentials already exist for this unit', 400);
    }

    const credential = await prisma.wlanCredential.create({
      data: {
        unitId,
        mandatorId,
        ssid,
        password,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: true,
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_WLAN_CREDENTIALS',
      entityType: 'WlanCredential',
      entityId: credential.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, credential, 'WLAN credentials created successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/wlan:
 *   get:
 *     tags: [Mandator - WLAN]
 *     summary: List all WLAN credentials
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of WLAN credentials
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const credentials = await prisma.wlanCredential.findMany({
      where: { mandatorId },
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
    });

    sendSuccess(res, credentials);
  })
);

/**
 * @swagger
 * /mandator/wlan/{id}:
 *   get:
 *     tags: [Mandator - WLAN]
 *     summary: Get WLAN credential details
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
 *         description: WLAN credential details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const credential = await prisma.wlanCredential.findFirst({
      where: { id: req.params.id, mandatorId },
      include: {
        unit: {
          include: {
            building: true,
            leases: {
              where: { status: 'ACTIVE' },
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
        },
      },
    });

    if (!credential) {
      return sendError(res, 'WLAN credential not found', 404);
    }

    sendSuccess(res, credential);
  })
);

/**
 * @swagger
 * /mandator/wlan/{id}:
 *   put:
 *     tags: [Mandator - WLAN]
 *     summary: Update WLAN credentials
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
 *               ssid:
 *                 type: string
 *               password:
 *                 type: string
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: WLAN credentials updated
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { ssid, password, validUntil } = req.body;

    const existing = await prisma.wlanCredential.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!existing) {
      return sendError(res, 'WLAN credential not found', 404);
    }

    const updateData: any = {};
    if (ssid) updateData.ssid = ssid;
    if (password) updateData.password = password;
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;

    const credential = await prisma.wlanCredential.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'UPDATE_WLAN_CREDENTIALS',
      entityType: 'WlanCredential',
      entityId: credential.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, credential, 'WLAN credentials updated successfully');
  })
);

/**
 * @swagger
 * /mandator/wlan/{id}/deactivate:
 *   patch:
 *     tags: [Mandator - WLAN]
 *     summary: Deactivate WLAN credentials
 *     description: Called during move-out to revoke access
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
 *         description: WLAN credentials deactivated
 */
router.patch(
  '/:id/deactivate',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const credential = await prisma.wlanCredential.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!credential) {
      return sendError(res, 'WLAN credential not found', 404);
    }

    const updated = await prisma.wlanCredential.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'DEACTIVATE_WLAN_CREDENTIALS',
      entityType: 'WlanCredential',
      entityId: credential.id,
      details: 'WLAN access revoked',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, updated, 'WLAN credentials deactivated successfully');
  })
);

export default router;
