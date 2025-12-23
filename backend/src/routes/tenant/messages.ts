import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, authorize, enforceDataIsolation } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendPaginated } from '../../utils/response';
import prisma from '../../config/database';

const router = Router();

router.use(authenticate);
router.use(authorize('tenant'));
router.use(enforceDataIsolation);

/**
 * @swagger
 * /tenant/messages:
 *   get:
 *     tags: [Tenant - Messages]
 *     summary: Get all messages from landlord
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
 *         description: List of messages
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { tenantId: req.user!.userId },
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
      }),
      prisma.message.count({ where: { tenantId: req.user!.userId } }),
    ]);

    sendPaginated(res, messages, page, limit, total);
  })
);

/**
 * @swagger
 * /tenant/messages/{id}/read:
 *   patch:
 *     tags: [Tenant - Messages]
 *     summary: Mark message as read
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message marked as read
 */
router.patch(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const message = await prisma.message.updateMany({
      where: {
        id: req.params.id,
        tenantId: req.user!.userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    sendSuccess(res, message, 'Message marked as read');
  })
);

/**
 * @swagger
 * /tenant/messages/{id}:
 *   get:
 *     tags: [Tenant - Messages]
 *     summary: Get message details
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
 *         description: Message details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const message = await prisma.message.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { recipientId: tenantId },
          { recipientType: 'ALL' },
        ],
      },
      include: {
        mandator: {
          select: {
            companyName: true,
          },
        },
      },
    });

    if (!message) {
      return sendError(res, 'Message not found', 404);
    }

    sendSuccess(res, message);
  })
);

export default router;
