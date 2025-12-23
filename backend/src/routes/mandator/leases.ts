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

/**
 * @swagger
 * /mandator/leases:
 *   get:
 *     tags: [Mandator - Leases]
 *     summary: List all leases
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of leases
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

    const [leases, total] = await Promise.all([
      prisma.lease.findMany({
        where,
        skip,
        take: limit,
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lease.count({ where }),
    ]);

    sendPaginated(res, leases, page, limit, total);
  })
);

// Additional lease management endpoints

const createLeaseSchema = z.object({
  body: z.object({
    tenantId: z.string().uuid(),
    unitId: z.string().uuid(),
    startDate: z.string(),
    endDate: z.string().optional(),
    rent: z.number(),
    deposit: z.number(),
    status: z.string().optional(),
  }),
});

/**
 * @swagger
 * /mandator/leases:
 *   post:
 *     tags: [Mandator - Leases]
 *     summary: Create new lease
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *               - unitId
 *               - startDate
 *               - rent
 *               - deposit
 *             properties:
 *               tenantId:
 *                 type: string
 *               unitId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               rent:
 *                 type: number
 *               deposit:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [DRAFT, SIGNED_LANDLORD, SIGNED_BOTH, ACTIVE, TERMINATED, COMPLETED]
 *     responses:
 *       201:
 *         description: Lease created successfully
 */
router.post(
  '/',
  validate(createLeaseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { tenantId, unitId, startDate, endDate, rent, deposit, status } = req.body;

    // Verify tenant and unit belong to mandator
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, mandatorId },
    });

    const unit = await prisma.unit.findFirst({
      where: { id: unitId, mandatorId },
    });

    if (!tenant) {
      return sendError(res, 'Tenant not found', 404);
    }

    if (!unit) {
      return sendError(res, 'Unit not found', 404);
    }

    const lease = await prisma.lease.create({
      data: {
        tenantId,
        unitId,
        mandatorId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        rent,
        deposit,
        status: status || 'DRAFT',
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_LEASE',
      entityType: 'Lease',
      entityId: lease.id,
      details: `Tenant: ${tenantId}, Unit: ${unitId}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, lease, 'Lease created successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/leases/{id}:
 *   get:
 *     tags: [Mandator - Leases]
 *     summary: Get lease details
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
 *         description: Lease details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, mandatorId },
      include: {
        tenant: true,
        unit: {
          include: {
            building: true,
          },
        },
        moveInProtocol: true,
        moveOutProtocol: true,
        finalBilling: true,
      },
    });

    if (!lease) {
      return sendError(res, 'Lease not found', 404);
    }

    sendSuccess(res, lease);
  })
);

/**
 * @swagger
 * /mandator/leases/{id}:
 *   put:
 *     tags: [Mandator - Leases]
 *     summary: Update lease
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
 *               endDate:
 *                 type: string
 *               rent:
 *                 type: number
 *               deposit:
 *                 type: number
 *     responses:
 *       200:
 *         description: Lease updated
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { endDate, rent, deposit } = req.body;

    const existing = await prisma.lease.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!existing) {
      return sendError(res, 'Lease not found', 404);
    }

    const updateData: any = {};
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (rent !== undefined) updateData.rent = rent;
    if (deposit !== undefined) updateData.deposit = deposit;

    const lease = await prisma.lease.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'UPDATE_LEASE',
      entityType: 'Lease',
      entityId: lease.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, lease, 'Lease updated successfully');
  })
);

/**
 * @swagger
 * /mandator/leases/{id}/terminate:
 *   post:
 *     tags: [Mandator - Leases]
 *     summary: Terminate lease
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
 *             required:
 *               - terminationDate
 *             properties:
 *               terminationDate:
 *                 type: string
 *                 format: date
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lease terminated
 */
router.post(
  '/:id/terminate',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { terminationDate, reason } = req.body;

    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!lease) {
      return sendError(res, 'Lease not found', 404);
    }

    if (lease.status === 'TERMINATED' || lease.status === 'COMPLETED') {
      return sendError(res, 'Lease already terminated', 400);
    }

    const updated = await prisma.lease.update({
      where: { id: req.params.id },
      data: {
        status: 'TERMINATED',
        endDate: terminationDate ? new Date(terminationDate) : new Date(),
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'TERMINATE_LEASE',
      entityType: 'Lease',
      entityId: lease.id,
      details: reason || 'Lease terminated',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, updated, 'Lease terminated successfully');
  })
);

/**
 * @swagger
 * /mandator/leases/{id}:
 *   delete:
 *     tags: [Mandator - Leases]
 *     summary: Delete draft lease
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
 *         description: Lease deleted
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!lease) {
      return sendError(res, 'Lease not found', 404);
    }

    if (lease.status !== 'DRAFT') {
      return sendError(res, 'Can only delete draft leases', 400);
    }

    await prisma.lease.delete({ where: { id: req.params.id } });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'DELETE_LEASE',
      entityType: 'Lease',
      entityId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, null, 'Lease deleted successfully');
  })
);

export default router;
