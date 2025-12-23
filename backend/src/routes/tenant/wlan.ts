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
 * /tenant/wlan:
 *   get:
 *     tags: [Tenant - WLAN]
 *     summary: Get current WLAN credentials
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: WLAN credentials
 *       404:
 *         description: No WLAN credentials found or not provided
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    // Get tenant's active lease
    const lease = await prisma.lease.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'SIGNED_BOTH'] },
      },
      include: {
        unit: {
          include: {
            wlanCredentials: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!lease || !lease.unit.wlanCredentials) {
      return sendError(res, 'No WLAN credentials available for your unit', 404);
    }

    sendSuccess(res, lease.unit.wlanCredentials);
  })
);

/**
 * @swagger
 * /tenant/wlan/qr-code:
 *   get:
 *     tags: [Tenant - WLAN]
 *     summary: Generate QR code for easy WiFi connection
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: QR code data
 */
router.get(
  '/qr-code',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const lease = await prisma.lease.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'SIGNED_BOTH'] },
      },
      include: {
        unit: {
          include: {
            wlanCredentials: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!lease || !lease.unit.wlanCredentials) {
      return sendError(res, 'No WLAN credentials available', 404);
    }

    const cred = lease.unit.wlanCredentials;
    // WiFi QR code format: WIFI:T:WPA;S:ssid;P:password;;
    const qrData = `WIFI:T:WPA;S:${cred.ssid};P:${cred.password};;`;

    sendSuccess(res, {
      qrData,
      ssid: cred.ssid,
      // Don't send password in response for security
    });
  })
);

export default router;
