import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, authorize, enforceDataIsolation } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';
import { createAuditLog } from '../../utils/audit';

const router = Router();

router.use(authenticate);
router.use(authorize('tenant'));
router.use(enforceDataIsolation);

/**
 * @swagger
 * /tenant/tasks:
 *   get:
 *     tags: [Tenant - Tasks]
 *     summary: Get assigned tasks
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of tasks
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tasks = await prisma.task.findMany({
      where: {
        tenantId: req.user!.userId,
      },
      include: {
        completions: {
          where: { tenantId: req.user!.userId },
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    sendSuccess(res, tasks);
  })
);

/**
 * @swagger
 * /tenant/tasks/{id}/complete:
 *   post:
 *     tags: [Tenant - Tasks]
 *     summary: Mark task as completed
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
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Task completed
 */
router.post(
  '/:id/complete',
  asyncHandler(async (req: Request, res: Response) => {
    const { notes } = req.body;
    const taskId = req.params.id;
    const tenantId = req.user!.userId;

    const completion = await prisma.taskCompletion.create({
      data: {
        taskId,
        tenantId,
        notes,
      },
    });

    await createAuditLog({
      mandatorId: req.user!.mandatorId!,
      userId: tenantId,
      userType: 'tenant',
      action: 'COMPLETE_TASK',
      entityType: 'TaskCompletion',
      entityId: completion.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, completion, 'Task completed successfully', 201);
  })
);

/**
 * @swagger
 * /tenant/tasks/{id}:
 *   get:
 *     tags: [Tenant - Tasks]
 *     summary: Get task details
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
 *         description: Task details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { assignedToId: tenantId },
          { assignedToType: 'ALL' },
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

    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    sendSuccess(res, task);
  })
);

/**
 * @swagger
 * /tenant/tasks/{id}/history:
 *   get:
 *     tags: [Tenant - Tasks]
 *     summary: Get task completion history
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
 *         description: Completion history
 */
router.get(
  '/:id/history',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.userId;

    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { assignedToId: tenantId },
          { assignedToType: 'ALL' },
        ],
      },
    });

    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    // Get completion history (assuming there's a completionLog field or similar)
    const history = {
      taskId: task.id,
      completions: task.completedAt ? [
        {
          completedAt: task.completedAt,
          completedBy: tenantId,
        },
      ] : [],
    };

    sendSuccess(res, history);
  })
);

export default router;
