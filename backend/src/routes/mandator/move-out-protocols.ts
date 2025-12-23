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

// All routes require mandator authentication
router.use(authenticate);
router.use(authorize('mandator'));
router.use(enforceDataIsolation);

// Validation schemas
const createMoveOutProtocolSchema = z.object({
  body: z.object({
    leaseId: z.string().uuid('Invalid lease ID'),
    protocolDate: z.string(),
    roomConditions: z.record(z.any()).optional(),
    meterReadings: z.record(z.any()).optional(),
    damages: z.record(z.any()).optional(),
    notes: z.string().optional(),
  }),
});

const updateMoveOutProtocolSchema = z.object({
  body: z.object({
    protocolDate: z.string().optional(),
    roomConditions: z.record(z.any()).optional(),
    meterReadings: z.record(z.any()).optional(),
    damages: z.record(z.any()).optional(),
    notes: z.string().optional(),
  }),
});

/**
 * @swagger
 * /mandator/protocols/move-out:
 *   post:
 *     tags: [Mandator - Protocols]
 *     summary: Create move-out protocol
 *     description: Create a move-out protocol for a terminated lease
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - leaseId
 *               - protocolDate
 *             properties:
 *               leaseId:
 *                 type: string
 *                 format: uuid
 *               protocolDate:
 *                 type: string
 *                 format: date-time
 *               roomConditions:
 *                 type: object
 *                 description: JSON object with room conditions at move-out
 *               meterReadings:
 *                 type: object
 *                 description: JSON object with final meter readings
 *               damages:
 *                 type: object
 *                 description: JSON object documenting any damages
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Move-out protocol created successfully
 *       400:
 *         description: Validation error or protocol already exists
 *       404:
 *         description: Lease not found
 */
router.post(
  '/',
  validate(createMoveOutProtocolSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { leaseId, protocolDate, roomConditions, meterReadings, damages, notes } = req.body;

    // Verify lease exists and belongs to mandator
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, mandatorId },
    });

    if (!lease) {
      return sendError(res, 'Lease not found', 404);
    }

    // Check if protocol already exists
    const existing = await prisma.moveOutProtocol.findUnique({
      where: { leaseId },
    });

    if (existing) {
      return sendError(res, 'Move-out protocol already exists for this lease', 400);
    }

    // Create protocol
    const protocol = await prisma.moveOutProtocol.create({
      data: {
        leaseId,
        mandatorId,
        protocolDate: new Date(protocolDate),
        roomConditions: JSON.stringify(roomConditions || {}),
        meterReadings: JSON.stringify(meterReadings || {}),
        damages: JSON.stringify(damages || {}),
        notes,
        status: 'DRAFT',
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_MOVE_OUT_PROTOCOL',
      entityType: 'MoveOutProtocol',
      entityId: protocol.id,
      details: `Created move-out protocol for lease ${leaseId}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, protocol, 'Move-out protocol created successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/protocols/move-out:
 *   get:
 *     tags: [Mandator - Protocols]
 *     summary: List all move-out protocols
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, SIGNED_LANDLORD, SIGNED_BOTH, COMPLETED]
 *     responses:
 *       200:
 *         description: List of move-out protocols
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const where: any = { mandatorId };
    if (status) {
      where.status = status;
    }

    const [protocols, total] = await Promise.all([
      prisma.moveOutProtocol.findMany({
        where,
        skip,
        take: limit,
        include: {
          lease: {
            include: {
              tenant: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              unit: {
                select: {
                  unitNumber: true,
                  building: {
                    select: {
                      name: true,
                      address: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.moveOutProtocol.count({ where }),
    ]);

    sendPaginated(res, protocols, page, limit, total);
  })
);

/**
 * @swagger
 * /mandator/protocols/move-out/{id}:
 *   get:
 *     tags: [Mandator - Protocols]
 *     summary: Get move-out protocol details
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Move-out protocol details
 *       404:
 *         description: Protocol not found
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { id } = req.params;

    const protocol = await prisma.moveOutProtocol.findFirst({
      where: { id, mandatorId },
      include: {
        lease: {
          include: {
            tenant: true,
            unit: {
              include: {
                building: true,
              },
            },
          },
        },
      },
    });

    if (!protocol) {
      return sendError(res, 'Move-out protocol not found', 404);
    }

    // Parse JSON fields
    const response = {
      ...protocol,
      roomConditions: JSON.parse(protocol.roomConditions),
      meterReadings: JSON.parse(protocol.meterReadings),
      damages: protocol.damages ? JSON.parse(protocol.damages) : null,
    };

    sendSuccess(res, response);
  })
);

/**
 * @swagger
 * /mandator/protocols/move-out/{id}:
 *   put:
 *     tags: [Mandator - Protocols]
 *     summary: Update move-out protocol
 *     description: Update protocol details. Can only update if not yet completed.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               protocolDate:
 *                 type: string
 *                 format: date-time
 *               roomConditions:
 *                 type: object
 *               meterReadings:
 *                 type: object
 *               damages:
 *                 type: object
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Protocol updated successfully
 *       400:
 *         description: Protocol already completed
 *       404:
 *         description: Protocol not found
 */
router.put(
  '/:id',
  validate(updateMoveOutProtocolSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { id } = req.params;
    const { protocolDate, roomConditions, meterReadings, damages, notes } = req.body;

    const existing =await prisma.moveOutProtocol.findFirst({
      where: { id, mandatorId },
    });

    if (!existing) {
      return sendError(res, 'Move-out protocol not found', 404);
    }

    if (existing.status === 'COMPLETED') {
      return sendError(res, 'Cannot update completed protocol', 400);
    }

    const updateData: any = {};
    if (protocolDate) updateData.protocolDate = new Date(protocolDate);
    if (roomConditions) updateData.roomConditions = JSON.stringify(roomConditions);
    if (meterReadings) updateData.meterReadings = JSON.stringify(meterReadings);
    if (damages) updateData.damages = JSON.stringify(damages);
    if (notes !== undefined) updateData.notes = notes;

    const protocol = await prisma.moveOutProtocol.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'UPDATE_MOVE_OUT_PROTOCOL',
      entityType: 'MoveOutProtocol',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, protocol, 'Protocol updated successfully');
  })
);

/**
 * @swagger
 * /mandator/protocols/move-out/{id}/sign-landlord:
 *   post:
 *     tags: [Mandator - Protocols]
 *     summary: Landlord signs move-out protocol
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               signature:
 *                 type: string
 *                 description: Base64 encoded signature
 *     responses:
 *       200:
 *         description: Protocol signed by landlord
 *       400:
 *         description: Protocol already signed by landlord
 *       404:
 *         description: Protocol not found
 */
router.post(
  '/:id/sign-landlord',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { id } = req.params;
    const { signature } = req.body;

    const protocol = await prisma.moveOutProtocol.findFirst({
      where: { id, mandatorId },
    });

    if (!protocol) {
      return sendError(res, 'Move-out protocol not found', 404);
    }

    if (protocol.landlordSignature) {
      return sendError(res, 'Protocol already signed by landlord', 400);
    }

    const updated = await prisma.moveOutProtocol.update({
      where: { id },
      data: {
        landlordSignature: signature || `LANDLORD_SIGNATURE_${Date.now()}`,
        landlordSignedAt: new Date(),
        status: 'SIGNED_LANDLORD',
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'SIGN_MOVE_OUT_PROTOCOL_LANDLORD',
      entityType: 'MoveOutProtocol',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, updated, 'Protocol signed by landlord successfully');
  })
);

/**
 * @swagger
 * /mandator/protocols/move-out/{id}/sign-tenant:
 *   post:
 *     tags: [Mandator - Protocols]
 *     summary: Tenant signs move-out protocol  
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signature
 *             properties:
 *               signature:
 *                 type: string
 *                 description: Base64 encoded tenant signature
 *     responses:
 *       200:
 *         description: Protocol signed by tenant
 *       400:
 *         description: Landlord must sign first or tenant already signed
 *       404:
 *         description: Protocol not found
 */
router.post(
  '/:id/sign-tenant',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { id } = req.params;
    const { signature } = req.body;

    if (!signature) {
      return sendError(res, 'Signature is required', 400);
    }

    const protocol = await prisma.moveOutProtocol.findFirst({
      where: { id, mandatorId },
      include: { lease: true },
    });

    if (!protocol) {
      return sendError(res, 'Move-out protocol not found', 404);
    }

    if (!protocol.landlordSignature) {
      return sendError(res, 'Landlord must sign the protocol first', 400);
    }

    if (protocol.tenantSignature) {
      return sendError(res, 'Protocol already signed by tenant', 400);
    }

    // Update protocol with tenant signature
    const updated = await prisma.moveOutProtocol.update({
      where: { id },
      data: {
        tenantSignature: signature,
        tenantSignedAt: new Date(),
        status: 'SIGNED_BOTH',
      },
    });

    // Update lease status to COMPLETED
    await prisma.lease.update({
      where: { id: protocol.leaseId },
      data: { status: 'COMPLETED' },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'SIGN_MOVE_OUT_PROTOCOL_TENANT',
      entityType: 'MoveOutProtocol',
      entityId: id,
      details: 'Move-out protocol fully signed',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, updated, 'Protocol signed by tenant successfully');
  })
);

export default router;
