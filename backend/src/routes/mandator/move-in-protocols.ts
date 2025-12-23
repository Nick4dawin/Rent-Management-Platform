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
const createMoveInProtocolSchema = z.object({
  body: z.object({
    leaseId: z.string().uuid('Invalid lease ID'),
    protocolDate: z.string(),
    roomConditions: z.record(z.any()).optional(),
    meterReadings: z.record(z.any()).optional(),
    notes: z.string().optional(),
  }),
});

const updateMoveInProtocolSchema = z.object({
  body: z.object({
    protocolDate: z.string().optional(),
    roomConditions: z.record(z.any()).optional(),
    meterReadings: z.record(z.any()).optional(),
    notes: z.string().optional(),
  }),
});

/**
 * @swagger
 * /mandator/protocols/move-in:
 *   post:
 *     tags: [Mandator - Protocols]
 *     summary: Create move-in protocol
 *     description: Create a move-in protocol for a lease. This must be signed by both landlord and tenant before tenant gets app access.
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
 *                 description: JSON object with room conditions (e.g., {living_room => good, bedroom => excellent})
 *               meterReadings:
 *                 type: object
 *                 description: JSON object with meter readings (e.g., {water_hot => 1234, water_cold => 5678})
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Move-in protocol created successfully
 *       400:
 *         description: Validation error or lease already has protocol
 *       404:
 *         description: Lease not found
 */
router.post(
  '/',
  validate(createMoveInProtocolSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { leaseId, protocolDate, roomConditions, meterReadings, notes } = req.body;

    // Verify lease exists and belongs to mandator
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, mandatorId },
    });

    if (!lease) {
      return sendError(res, 'Lease not found', 404);
    }

    // Check if protocol already exists
    const existing = await prisma.moveInProtocol.findUnique({
      where: { leaseId },
    });

    if (existing) {
      return sendError(res, 'Move-in protocol already exists for this lease', 400);
    }

    // Create protocol
    const protocol = await prisma.moveInProtocol.create({
      data: {
        leaseId,
        mandatorId,
        protocolDate: new Date(protocolDate),
        roomConditions: JSON.stringify(roomConditions || {}),
        meterReadings: JSON.stringify(meterReadings || {}),
        notes,
        status: 'DRAFT',
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_MOVE_IN_PROTOCOL',
      entityType: 'MoveInProtocol',
      entityId: protocol.id,
      details: `Created move-in protocol for lease ${leaseId}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, protocol, 'Move-in protocol created successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/protocols/move-in:
 *   get:
 *     tags: [Mandator - Protocols]
 *     summary: List all move-in protocols
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
 *         description: List of move-in protocols
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
      prisma.moveInProtocol.findMany({
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
      prisma.moveInProtocol.count({ where }),
    ]);

    sendPaginated(res, protocols, page, limit, total);
  })
);

/**
 * @swagger
 * /mandator/protocols/move-in/{id}:
 *   get:
 *     tags: [Mandator - Protocols]
 *     summary: Get move-in protocol details
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
 *         description: Move-in protocol details
 *       404:
 *         description: Protocol not found
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { id } = req.params;

    const protocol = await prisma.moveInProtocol.findFirst({
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
      return sendError(res, 'Move-in protocol not found', 404);
    }

    // Parse JSON fields
    const response = {
      ...protocol,
      roomConditions: JSON.parse(protocol.roomConditions),
      meterReadings: JSON.parse(protocol.meterReadings),
    };

    sendSuccess(res, response);
  })
);

/**
 * @swagger
 * /mandator/protocols/move-in/{id}:
 *   put:
 *     tags: [Mandator - Protocols]
 *     summary: Update move-in protocol
 *     description: Update protocol details. Can only update if status is DRAFT or SIGNED_LANDLORD.
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
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Protocol updated successfully
 *       400:
 *         description: Protocol already signed by both parties
 *       404:
 *         description: Protocol not found
 */
router.put(
  '/:id',
  validate(updateMoveInProtocolSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { id } = req.params;
    const { protocolDate, roomConditions, meterReadings, notes } = req.body;

    const existing = await prisma.moveInProtocol.findFirst({
      where: { id, mandatorId },
    });

    if (!existing) {
      return sendError(res, 'Move-in protocol not found', 404);
    }

    if (existing.status === 'SIGNED_BOTH' || existing.status === 'COMPLETED') {
      return sendError(res, 'Cannot update protocol after both parties have signed', 400);
    }

    const updateData: any = {};
    if (protocolDate) updateData.protocolDate = new Date(protocolDate);
    if (roomConditions) updateData.roomConditions = JSON.stringify(roomConditions);
    if (meterReadings) updateData.meterReadings = JSON.stringify(meterReadings);
    if (notes !== undefined) updateData.notes = notes;

    const protocol = await prisma.moveInProtocol.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'UPDATE_MOVE_IN_PROTOCOL',
      entityType: 'MoveInProtocol',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, protocol, 'Protocol updated successfully');
  })
);

/**
 * @swagger
 * /mandator/protocols/move-in/{id}/sign-landlord:
 *   post:
 *     tags: [Mandator - Protocols]
 *     summary: Landlord signs move-in protocol
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
 *                 description: Base64 encoded signature or signature data
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

    const protocol = await prisma.moveInProtocol.findFirst({
      where: { id, mandatorId },
    });

    if (!protocol) {
      return sendError(res, 'Move-in protocol not found', 404);
    }

    if (protocol.landlordSignature) {
      return sendError(res, 'Protocol already signed by landlord', 400);
    }

    const updated = await prisma.moveInProtocol.update({
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
      action: 'SIGN_MOVE_IN_PROTOCOL_LANDLORD',
      entityType: 'MoveInProtocol',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, updated, 'Protocol signed by landlord successfully');
  })
);

/**
 * @swagger
 * /mandator/protocols/move-in/{id}/sign-tenant:
 *   post:
 *     tags: [Mandator - Protocols]
 *     summary: Tenant signs move-in protocol on landlord's tablet
 *     description: CRITICAL - This signature enables tenant app access. After both signatures, tenant can register for the app.
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
 *                 description: Base64 encoded tenant signature captured on tablet
 *     responses:
 *       200:
 *         description: Protocol signed by tenant, app access granted
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

    const protocol = await prisma.moveInProtocol.findFirst({
      where: { id, mandatorId },
      include: { lease: true },
    });

    if (!protocol) {
      return sendError(res, 'Move-in protocol not found', 404);
    }

    if (!protocol.landlordSignature) {
      return sendError(res, 'Landlord must sign the protocol first', 400);
    }

    if (protocol.tenantSignature) {
      return sendError(res, 'Protocol already signed by tenant', 400);
    }

    // Update protocol with tenant signature
    const updated = await prisma.moveInProtocol.update({
      where: { id },
      data: {
        tenantSignature: signature,
        tenantSignedAt: new Date(),
        status: 'SIGNED_BOTH',
      },
    });

    // Update lease status to ACTIVE
    await prisma.lease.update({
      where: { id: protocol.leaseId },
      data: { status: 'ACTIVE' },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'SIGN_MOVE_IN_PROTOCOL_TENANT',
      entityType: 'MoveInProtocol',
      entityId: id,
      details: 'Tenant signed on landlord tablet - APP ACCESS GRANTED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, updated, 'Protocol signed by tenant. Tenant can now register for app access.');
  })
);

/**
 * @swagger
 * /mandator/protocols/move-in/{id}:
 *   delete:
 *     tags: [Mandator - Protocols]
 *     summary: Delete draft move-in protocol
 *     description: Can only delete protocols in DRAFT status
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
 *         description: Protocol deleted successfully
 *       400:
 *         description: Cannot delete signed protocols
 *       404:
 *         description: Protocol not found
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { id } = req.params;

    const protocol = await prisma.moveInProtocol.findFirst({
      where: { id, mandatorId },
    });

    if (!protocol) {
      return sendError(res, 'Move-in protocol not found', 404);
    }

    if (protocol.status !== 'DRAFT') {
      return sendError(res, 'Can only delete draft protocols', 400);
    }

    await prisma.moveInProtocol.delete({ where: { id } });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'DELETE_MOVE_IN_PROTOCOL',
      entityType: 'MoveInProtocol',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, null, 'Protocol deleted successfully');
  })
);

export default router;
