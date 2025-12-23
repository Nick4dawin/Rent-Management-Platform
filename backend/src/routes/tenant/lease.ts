import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, authorize, enforceDataIsolation } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';

const router = Router();

router.use(authenticate);
router.use(authorize('tenant'));
router.use(enforceDataIsolation);

/**
 * @swagger
 * /tenant/lease:
 *   get:
 *     tags: [Tenant - Lease]
 *     summary: Get current lease details
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lease details
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const lease = await prisma.lease.findFirst({
      where: {
        tenantId: req.user!.userId,
        status: { in: ['ACTIVE', 'SIGNED_BOTH'] },
      },
      include: {
        unit: {
          include: {
            building: {
              select: {
                name: true,
                address: true,
                city: true,
                postalCode: true,
              },
            },
          },
        },
        moveInProtocol: true,
      },
    });

    sendSuccess(res, lease);
  })
);

export default router;
