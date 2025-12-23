import { Router } from 'express';
import authRoutes from './auth';
import profileRoutes from './profile';
import leaseRoutes from './lease';
import messagesRoutes from './messages';
import tasksRoutes from './tasks';
import wlanRoutes from './wlan';
import consumptionRoutes from './consumption';
import protocolsRoutes from './protocols';
import alarmRoutes from './alarm';
import billingRoutes from './billing';
import documentsRoutes from './documents';

const router = Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/lease', leaseRoutes);
router.use('/messages', messagesRoutes);
router.use('/tasks', tasksRoutes);
router.use('/wlan', wlanRoutes);
router.use('/consumption', consumptionRoutes);
router.use('/protocols', protocolsRoutes);
router.use('/alarm', alarmRoutes);
router.use('/billing', billingRoutes);
router.use('/documents', documentsRoutes);

export default router;
