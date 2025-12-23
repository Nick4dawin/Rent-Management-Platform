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
 * /tenant/profile:
 *   get:
 *     tags: [Tenant - Profile]
 *     summary: Get tenant profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant profile
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isVerified: true,
        createdAt: true,
      },
    });

    sendSuccess(res, tenant);
  })
);

/**
 * @swagger
 * /tenant/profile:
 *   put:
 *     tags: [Tenant - Profile]
 *     summary: Update tenant profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;
    const { firstName, lastName, phone } = req.body;

    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await createAuditLog({
      mandatorId: req.user!.mandatorId!,
      userId: tenantId,
      userType: 'tenant',
      action: 'UPDATE_PROFILE',
      entityType: 'Tenant',
      entityId: tenantId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, tenant, 'Profile updated successfully');
  })
);

export default router;
