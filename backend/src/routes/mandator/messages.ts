import { Router } from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authenticate, authorize, enforceDataIsolation } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendPaginated } from '../../utils/response';
import prisma from '../../config/database';
import { createAuditLog } from '../../utils/audit';
import { sendNotificationSMS } from '../../utils/sms';

const router = Router();

router.use(authenticate);
router.use(authorize('mandator'));
router.use(enforceDataIsolation);

const sendMessageSchema = z.object({
  body: z.object({
    tenantId: z.string().uuid().optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
    sendSMS: z.boolean().optional(),
  }),
});

/**
 * @swagger
 * /mandator/messages:
 *   post:
 *     tags: [Mandator - Communication]
 *     summary: Send message to tenant
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - body
 *             properties:
 *               tenantId:
 *                 type: string
 *               subject:
 *                 type: string
 *               body:
 *                 type: string
 *               sendSMS:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Message sent
 */
router.post(
  '/',
  validate(sendMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { tenantId, subject, body, sendSMS } = req.body;

    const message = await prisma.message.create({
      data: {
        mandatorId,
        tenantId,
        subject,
        body,
        notificationType: sendSMS ? 'SMS' : null,
      },
    });

    // Send SMS if requested
    if (sendSMS && tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (tenant) {
        const smsBody = `${subject}: ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`;
        await sendNotificationSMS(tenant.phone, smsBody);
        await prisma.message.update({
          where: { id: message.id },
          data: { notificationSent: true },
        });
      }
    }

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'SEND_MESSAGE',
      entityType: 'Message',
      entityId: message.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, message, 'Message sent successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/messages:
 *   get:
 *     tags: [Mandator - Communication]
 *     summary: List all messages
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
    const mandatorId = req.user!.mandatorId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { mandatorId },
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
        },
        orderBy: { sentAt: 'desc' },
      }),
      prisma.message.count({ where: { mandatorId } }),
    ]);

    sendPaginated(res, messages, page, limit, total);
  })
);

export default router;
