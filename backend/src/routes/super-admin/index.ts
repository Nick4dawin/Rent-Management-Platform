import { Router } from 'express';
import authRoutes from './auth';
import mandatorRoutes from './mandators';
import analyticsRoutes from './analytics';

const router = Router();

router.use('/auth', authRoutes);
router.use('/mandators', mandatorRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
