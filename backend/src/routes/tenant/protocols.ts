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
 * /tenant/protocols/move-in:
 *   get:
 *     tags: [Tenant - Protocols]
 *     summary: Get current move-in protocol
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Move-in protocol details
 */
router.get(
  '/move-in',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const lease = await prisma.lease.findFirst({
      where: { tenantId },
      include: {
        moveInProtocol: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lease || !lease.moveInProtocol) {
      return sendError(res, 'No move-in protocol found', 404);
    }

    const protocol = {
      ...lease.moveInProtocol,
      roomConditions: JSON.parse(lease.moveInProtocol.roomConditions),
      meterReadings: JSON.parse(lease.moveInProtocol.meterReadings),
    };

    sendSuccess(res, protocol);
  })
);

/**
 * @swagger
 * /tenant/protocols/move-in/document:
 *   get:
 *     tags: [Tenant - Protocols]
 *     summary: Download move-in protocol PDF
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: PDF document
 */
router.get(
  '/move-in/document',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const lease = await prisma.lease.findFirst({
      where: { tenantId },
      include: {
        moveInProtocol: true,
      },
    });

    if (!lease || !lease.moveInProtocol) {
      return sendError(res, 'No move-in protocol found', 404);
    }

    // TODO: Generate PDF using PDF service
    // For now, return protocol data
    sendSuccess(res, {
      message: 'PDF generation to be implemented',
      protocolId: lease.moveInProtocol.id,
    });
  })
);

/**
 * @swagger
 * /tenant/protocols/move-out:
 *   get:
 *     tags: [Tenant - Protocols]
 *     summary: Get current move-out protocol
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Move-out protocol details
 */
router.get(
  '/move-out',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const lease = await prisma.lease.findFirst({
      where: { tenantId },
      include: {
        moveOutProtocol: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lease || !lease.moveOutProtocol) {
      return sendError(res, 'No move-out protocol found', 404);
    }

    const protocol = {
      ...lease.moveOutProtocol,
      roomConditions: JSON.parse(lease.moveOutProtocol.roomConditions),
      meterReadings: JSON.parse(lease.moveOutProtocol.meterReadings),
      damages: lease.moveOutProtocol.damages ? JSON.parse(lease.moveOutProtocol.damages) : null,
    };

    sendSuccess(res, protocol);
  })
);

/**
 * @swagger
 * /tenant/protocols/move-out/document:
 *   get:
 *     tags: [Tenant - Protocols]
 *     summary: Download move-out protocol PDF
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: PDF document
 */
router.get(
  '/move-out/document',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const lease = await prisma.lease.findFirst({
      where: { tenantId },
      include: {
        moveOutProtocol: true,
      },
    });

    if (!lease || !lease.moveOutProtocol) {
      return sendError(res, 'No move-out protocol found', 404);
    }

    // TODO: Generate PDF using PDF service
    sendSuccess(res, {
      message: 'PDF generation to be implemented',
      protocolId: lease.moveOutProtocol.id,
    });
  })
);

export default router;
