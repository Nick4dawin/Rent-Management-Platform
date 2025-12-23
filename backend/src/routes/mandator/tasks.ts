import { Router } from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authenticate, authorize, enforceDataIsolation } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendPaginated } from '../../utils/response';
import prisma from '../../config/database';
import { createAuditLog } from '../../utils/audit';

const router = Router();

router.use(authenticate);
router.use(authorize('mandator'));
router.use(enforceDataIsolation);

const createTaskSchema = z.object({
  body: z.object({
    unitId: z.string().uuid().optional(),
    tenantId: z.string().uuid().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    dueDate: z.string().optional(),
    isRecurring: z.boolean().optional(),
    recurrence: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  }),
});

/**
 * @swagger
 * /mandator/tasks:
 *   post:
 *     tags: [Mandator - Tasks]
 *     summary: Create task
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               unitId:
 *                 type: string
 *               tenantId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               isRecurring:
 *                 type: boolean
 *               recurrence:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *     responses:
 *       201:
 *         description: Task created
 */
router.post(
  '/',
  validate(createTaskSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { dueDate, ...taskData } = req.body;

    const task = await prisma.task.create({
      data: {
        ...taskData,
        mandatorId,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: taskData.priority || 'MEDIUM',
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: 'mandator',
      action: 'CREATE_TASK',
      entityType: 'Task',
      entityId: task.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, task, 'Task created successfully', 201);
  })
);

/**
 * @swagger
 * /mandator/tasks:
 *   get:
 *     tags: [Mandator - Tasks]
 *     summary: List all tasks
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
 *         description: List of tasks
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: { mandatorId },
        skip,
        take: limit,
        include: {
          completions: {
            select: {
              id: true,
              completedAt: true,
              tenant: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: { completedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.task.count({ where: { mandatorId } }),
    ]);

    sendPaginated(res, tasks, page, limit, total);
  })
);

export default router;
