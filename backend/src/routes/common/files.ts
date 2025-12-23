import { Router } from 'express';
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { sendSuccess, sendError } from '../../utils/response';
import prisma from '../../config/database';
import { createAuditLog } from '../../utils/audit';
import { CONFIG } from '../../config';
import fs from 'fs/promises';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = CONFIG.UPLOAD_DIR;
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error: any) {
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: CONFIG.UPLOAD_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

/**
 * @swagger
 * /upload:
 *   post:
 *     tags: [Files]
 *     summary: Upload a file
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               entityType:
 *                 type: string
 *               entityId:
 *                 type: string
 *     responses:
 *       201:
 *         description: File uploaded successfully
 */
router.post(
  '/',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return sendError(res, 'No file uploaded', 400);
    }

    const mandatorId = req.user!.mandatorId!;
    const { entityType, entityId } = req.body;

    const file = await prisma.file.create({
      data: {
        mandatorId,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        uploadedBy: req.user!.userId,
      },
    });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: req.user!.userType,
      action: 'UPLOAD_FILE',
      entityType: 'File',
      entityId: file.id,
      details: `Uploaded: ${req.file.originalname}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, file, 'File uploaded successfully', 201);
  })
);

/**
 * @swagger
 * /files:
 *   get:
 *     tags: [Files]
 *     summary: List files
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of files
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;
    const { entityType, entityId } = req.query;

    const files = await prisma.file.findMany({
      where: { mandatorId },
      orderBy: { uploadedAt: 'desc' },
    });

    sendSuccess(res, files);
  })
);

/**
 * @swagger
 * /files/{id}:
 *   get:
 *     tags: [Files]
 *     summary: Download file
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
 *         description: File download
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const file = await prisma.file.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!file) {
      return sendError(res, 'File not found', 404);
    }

    // Send file
    res.download(file.path, file.originalName);
  })
);

/**
 * @swagger
 * /files/{id}/metadata:
 *   get:
 *     tags: [Files]
 *     summary: Get file metadata
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
 *         description: File metadata
 */
router.get(
  '/:id/metadata',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const file = await prisma.file.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!file) {
      return sendError(res, 'File not found', 404);
    }

    sendSuccess(res, file);
  })
);

/**
 * @swagger
 * /files/{id}:
 *   delete:
 *     tags: [Files]
 *     summary: Delete file
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
 *         description: File deleted
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const mandatorId = req.user!.mandatorId!;

    const file = await prisma.file.findFirst({
      where: { id: req.params.id, mandatorId },
    });

    if (!file) {
      return sendError(res, 'File not found', 404);
    }

    // Delete physical file
    try {
      await fs.unlink(file.path);
    } catch (error) {
      // File might not exist, continue anyway
    }

    // Delete database record
    await prisma.file.delete({ where: { id: req.params.id } });

    await createAuditLog({
      mandatorId,
      userId: req.user!.userId,
      userType: req.user!.userType,
      action: 'DELETE_FILE',
      entityType: 'File',
      entityId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, null, 'File deleted successfully');
  })
);

export default router;
