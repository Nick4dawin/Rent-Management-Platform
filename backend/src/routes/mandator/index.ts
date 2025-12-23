import { Router } from 'express';
import authRoutes from './auth';
import buildingsRoutes from './buildings';
import unitsRoutes from './units';
import tenantsRoutes from './tenants';
import leasesRoutes from './leases';
import messagesRoutes from './messages';
import tasksRoutes from './tasks';
import protocolsRoutes from './protocols';
import metersRoutes from './meters';
import sensorsRoutes from './sensors';
import mainMetersRoutes from './main-meters';
import wlanRoutes from './wlan';
import consumptionRoutes from './consumption';
import billingRoutes from './billing';

const router = Router();

router.use('/auth', authRoutes);
router.use('/buildings', buildingsRoutes);
router.use('/units', unitsRoutes);
router.use('/tenants', tenantsRoutes);
router.use('/leases', leasesRoutes);
router.use('/messages', messagesRoutes);
router.use('/tasks', tasksRoutes);
router.use('/protocols', protocolsRoutes);
router.use('/meters', metersRoutes);
router.use('/sensors', sensorsRoutes);
router.use('/main-meters', mainMetersRoutes);
router.use('/wlan', wlanRoutes);
router.use('/consumption', consumptionRoutes);
router.use('/billing', billingRoutes);

export default router;
