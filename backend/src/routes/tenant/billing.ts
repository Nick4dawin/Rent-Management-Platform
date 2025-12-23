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
 * /tenant/billing/final:
 *   get:
 *     tags: [Tenant - Billing]
 *     summary: Get final billing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Final billing details
 */
router.get(
  '/final',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const lease = await prisma.lease.findFirst({
      where: { tenantId },
      include: {
        finalBilling: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lease || !lease.finalBilling) {
      return sendError(res, 'No final billing found', 404);
    }

    const billing = {
      ...lease.finalBilling,
      details: JSON.parse(lease.finalBilling.details),
    };

    sendSuccess(res, billing);
  })
);

/**
 * @swagger
 * /tenant/billing/final/document:
 *   get:
 *     tags: [Tenant - Billing]
 *     summary: Download final billing PDF
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: PDF document
 */
router.get(
  '/final/document',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const lease = await prisma.lease.findFirst({
      where: { tenantId },
      include: {
        finalBilling: true,
      },
    });

    if (!lease || !lease.finalBilling) {
      return sendError(res, 'No final billing found', 404);
    }

    // TODO: Generate PDF using PDF service
    sendSuccess(res, {
      message: 'PDF generation to be implemented',
      billingId: lease.finalBilling.id,
    });
  })
);

/**
 * @swagger
 * /tenant/billing/final/breakdown:
 *   get:
 *     tags: [Tenant - Billing]
 *     summary: Get detailed cost breakdown
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed breakdown
 */
router.get(
  '/final/breakdown',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const lease = await prisma.lease.findFirst({
      where: { tenantId },
      include: {
        finalBilling: true,
      },
    });

    if (!lease || !lease.finalBilling) {
      return sendError(res, 'No final billing found', 404);
    }

    const details = JSON.parse(lease.finalBilling.details);
    const breakdown = {
      billingPeriod: {
        start: lease.finalBilling.billingPeriodStart,
        end: lease.finalBilling.billingPeriodEnd,
      },
      rentAmount: lease.finalBilling.rentAmount,
      utilitiesAmount: lease.finalBilling.utilitiesAmount || 0,
      deductions: lease.finalBilling.deductions || 0,
      totalAmount: lease.finalBilling.totalAmount,
      isPaid: lease.finalBilling.isPaid,
      paidAt: lease.finalBilling.paidAt,
      details,
    };

    sendSuccess(res, breakdown);
  })
);

export default router;
