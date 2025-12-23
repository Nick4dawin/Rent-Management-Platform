import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';

const router = Router();

// All routes require super-admin authentication
router.use(authenticate);
router.use(authorize('super-admin'));

/**
 * @swagger
 * /super-admin/analytics/overview:
 *   get:
 *     tags: [Super Admin - Analytics]
 *     summary: Get system-wide analytics overview
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: System analytics
 */
router.get(
  '/overview',
  asyncHandler(async (req: Request, res: Response) => {
    const [
      totalMandators,
      activeMandators,
      totalBuildings,
      totalUnits,
      totalTenants,
    ] = await Promise.all([
      prisma.mandator.count(),
      prisma.mandator.count({ where: { isActive: true } }),
      prisma.building.count(),
      prisma.unit.count(),
      prisma.tenant.count(),
    ]);

    const analytics = {
      totalMandators,
      activeMandators,
      inactiveMandators: totalMandators - activeMandators,
      totalBuildings,
      totalUnits,
      totalTenants,
    };

    sendSuccess(res, analytics, 'Analytics retrieved successfully');
  })
);

export default router;
