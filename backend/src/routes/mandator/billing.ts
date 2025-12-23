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

const createBillingSchema = z.object({
  body: z.object({
    leaseId: z.string().uuid(),
    billingPeriodStart: z.string(),
    billingPeriodEnd: z.string(),
    rentAmount: z.number(),
    utilitiesAmount: z.number().optional(),
    deductions: z.number().optional(),
    details: z.record(z.any()),
  }),
});

/**
 * @swagger
 * /mandator/billing/final:
 *   post:
 *     tags: [Mandator - Billing]
 *     summary: Create final billing (manual entry for Phase 1)
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
 *               - billingPeriodStart
 *               - billingPeriodEnd
 *               - rentAmount
 *               - details
 *             properties:
 *               leaseId:
 *                 type: string
 *               billingPeriodStart:
 *                 type: string
 *                 format: date
 *               billingPeriodEnd:
 *                 type: string
 *                 format: date
 *               rentAmount:
 *                 type: number
 *               utilitiesAmount:
 *                 type: number
 *               deductions:
 *                 type: number
 *               details:
 *                 type: object
 *                 description: JSON with calculation breakdown
 *     responses:
 *       201:
 *         description: Final billing created
 */
router.post(
  '/final',
  validate(createBillingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { leaseId, billingPeriodStart, billingPeriodEnd, rentAmount, utilitiesAmount, deductions, details } = req.body;

    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, mandatorId },
    });

    if (!lease) {
      return sendError(res, 'Lease not found', 404);
    }

    const existing = await prisma.finalBilling.findUnique({
      where: { leaseId },
    });

    if (existing) {
      return sendError(res, 'Final billing already exists for this lease', 400);
    }

    const totalAmount = rentAmount + (utilitiesAmount || 0) - (deductions || 0);

    const billing = await prisma.finalBilling.create({
      data: {
        leaseId,
        mandatorId,
        billingPeriodStart: new Date(billingPeriodStart),
        billingPeriodEnd: new Date(billingPeriodEnd),
        rentAmount,
        utilitiesAmount,
        deductions,
        totalAmount,
        details: JSON.stringify(details),
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_FINAL_BILLING',
      entityType: 'FinalBilling',
      entityId: billing.id,
      details: `Total: €${totalAmount}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, billing, 'Final billing created successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/billing/final:
 *   get:
 *     tags: [Mandator - Billing]
 *     summary: List all final billings
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
 *     responses:
 *       200:
 *         description: List of final billings
 */
router.get(
  '/final',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [billings, total] = await Promise.all([
      prisma.finalBilling.findMany({
        where: { mandatorId },
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
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.finalBilling.count({ where: { mandatorId } }),
    ]);

    sendPaginated(res, billings, page, limit, total);
  })
);

/**
 * @swagger
 * /mandator/billing/final/{id}:
 *   get:
 *     tags: [Mandator - Billing]
 *     summary: Get final billing details
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
 *         description: Billing details
 */
router.get(
  '/final/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const billing = await prisma.finalBilling.findFirst({
      where: { id: req.params.id, mandatorId },
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

    if (!billing) {
      return sendError(res, 'Billing not found', 404);
    }

    const response = {
      ...billing,
      details: JSON.parse(billing.details),
    };

    sendSuccess(res, response);
  })
);

/**
 * @swagger
 * /mandator/billing/final/{id}:
 *   put:
 *     tags: [Mandator - Billing]
 *     summary: Update final billing
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
 *               rentAmount:
 *                 type: number
 *               utilitiesAmount:
 *                 type: number
 *               deductions:
 *                 type: number
 *               details:
 *                 type: object
 *     responses:
 *       200:
 *         description: Billing updated
 */
router.put(
  '/final/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { rentAmount, utilitiesAmount, deductions, details } = req.body;

    const existing = await prisma.finalBilling.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!existing) {
      return sendError(res, 'Billing not found', 404);
    }

    if (existing.isPaid) {
      return sendError(res, 'Cannot update paid billing', 400);
    }

    const updateData: any = {};
    if (rentAmount !== undefined) updateData.rentAmount = rentAmount;
    if (utilitiesAmount !== undefined) updateData.utilitiesAmount = utilitiesAmount;
    if (deductions !== undefined) updateData.deductions = deductions;
    if (details) updateData.details = JSON.stringify(details);

    if (rentAmount !== undefined || utilitiesAmount !== undefined || deductions !== undefined) {
      updateData.totalAmount = (rentAmount || existing.rentAmount) + 
        (utilitiesAmount !== undefined ? utilitiesAmount : (existing.utilitiesAmount || 0)) - 
        (deductions !== undefined ? deductions : (existing.deductions || 0));
    }

    const billing = await prisma.finalBilling.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'UPDATE_FINAL_BILLING',
      entityType: 'FinalBilling',
      entityId: billing.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, billing, 'Billing updated successfully');
  })
);

/**
 * @swagger
 * /mandator/billing/final/{id}/calculate:
 *   post:
 *     tags: [Mandator - Billing]
 *     summary: Recalculate final billing
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
 *         description: Billing recalculated
 */
router.post(
  '/final/:id/calculate',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const billing = await prisma.finalBilling.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!billing) {
      return sendError(res, 'Billing not found', 404);
    }

    const totalAmount = billing.rentAmount + (billing.utilitiesAmount || 0) - (billing.deductions || 0);

    const updated = await prisma.finalBilling.update({
      where: { id: req.params.id },
      data: { totalAmount },
    });

    sendSuccess(res, updated, 'Billing recalculated successfully');
  })
);

/**
 * @swagger
 * /mandator/billing/final/{id}/document:
 *   get:
 *     tags: [Mandator - Billing]
 *     summary: Download final billing PDF
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
 *         description: PDF document
 */
router.get(
  '/final/:id/document',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const billing = await prisma.finalBilling.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!billing) {
      return sendError(res, 'Billing not found', 404);
    }

    // TODO: Generate PDF using PDF service
    sendSuccess(res, {
      message: 'PDF generation to be implemented',
      billingId: billing.id,
    });
  })
);

/**
 * @swagger
 * /mandator/billing/final/{id}/mark-paid:
 *   patch:
 *     tags: [Mandator - Billing]
 *     summary: Mark billing as paid
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
 *         description: Billing marked as paid
 */
router.patch(
  '/final/:id/mark-paid',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const billing = await prisma.finalBilling.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!billing) {
      return sendError(res, 'Billing not found', 404);
    }

    const updated = await prisma.finalBilling.update({
      where: { id: req.params.id },
      data: {
        isPaid: true,
        paidAt: new Date(),
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'MARK_BILLING_PAID',
      entityType: 'FinalBilling',
      entityId: billing.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, updated, 'Billing marked as paid');
  })
);

export default router;
