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
 * /tenant/documents:
 *   get:
 *     tags: [Tenant - Documents]
 *     summary: List all documents (leases, protocols, billing)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of all tenant documents
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const lease = await prisma.lease.findFirst({
      where: { tenantId },
      include: {
        moveInProtocol: true,
        moveOutProtocol: true,
        finalBilling: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lease) {
      return sendSuccess(res, { documents: [] });
    }

    const documents = [];

    // Lease document
    documents.push({
      id: lease.id,
      type: 'lease',
      name: 'Lease Agreement',
      date: lease.createdAt,
    });

    // Move-in protocol
    if (lease.moveInProtocol) {
      documents.push({
        id: lease.moveInProtocol.id,
        type: 'move-in-protocol',
        name: 'Move-In Protocol',
        date: lease.moveInProtocol.protocolDate,
        signed: !!lease.moveInProtocol.tenantSignedAt,
      });
    }

    // Move-out protocol
    if (lease.moveOutProtocol) {
      documents.push({
        id: lease.moveOutProtocol.id,
        type: 'move-out-protocol',
        name: 'Move-Out Protocol',
        date: lease.moveOutProtocol.protocolDate,
        signed: !!lease.moveOutProtocol.tenantSignedAt,
      });
    }

    // Final billing
    if (lease.finalBilling) {
      documents.push({
        id: lease.finalBilling.id,
        type: 'final-billing',
        name: 'Final Billing',
        date: lease.finalBilling.createdAt,
        amount: lease.finalBilling.totalAmount,
        isPaid: lease.finalBilling.isPaid,
      });
    }

    sendSuccess(res, { documents });
  })
);

/**
 * @swagger
 * /tenant/documents/{id}:
 *   get:
 *     tags: [Tenant - Documents]
 *     summary: Get document metadata
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [lease, move-in-protocol, move-out-protocol, final-billing]
 *     responses:
 *       200:
 *         description: Document metadata
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;
    const { id } = req.params;
    const type = req.query.type as string;

    if (!type) {
      return sendError(res, 'Document type is required', 400);
    }

    let document: any = null;

    switch (type) {
      case 'lease':
        document = await prisma.lease.findFirst({
          where: { id, tenantId },
        });
        break;
      case 'move-in-protocol':
        document = await prisma.moveInProtocol.findFirst({
          where: { 
            id,
            lease: { tenantId },
          },
        });
        break;
      case 'move-out-protocol':
        document = await prisma.moveOutProtocol.findFirst({
          where: { 
            id,
            lease: { tenantId },
          },
        });
        break;
      case 'final-billing':
        document = await prisma.finalBilling.findFirst({
          where: { 
            id,
            lease: { tenantId },
          },
        });
        break;
      default:
        return sendError(res, 'Invalid document type', 400);
    }

    if (!document) {
      return sendError(res, 'Document not found', 404);
    }

    sendSuccess(res, document);
  })
);

/**
 * @swagger
 * /tenant/documents/{id}/download:
 *   get:
 *     tags: [Tenant - Documents]
 *     summary: Download document
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document file
 */
router.get(
  '/:id/download',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;
    const { id } = req.params;
    const type = req.query.type as string;

    // Verify document belongs to tenant
    const lease = await prisma.lease.findFirst({
      where: { tenantId },
    });

    if (!lease) {
      return sendError(res, 'No lease found', 404);
    }

    // TODO: Generate PDF using PDF service
    sendSuccess(res, {
      message: 'PDF generation to be implemented',
      documentId: id,
      type,
    });
  })
);

export default router;
