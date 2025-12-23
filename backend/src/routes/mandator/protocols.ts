import { Router } from 'express';
import moveInProtocolsRoutes from './move-in-protocols';
import moveOutProtocolsRoutes from './move-out-protocols';

const router = Router();

router.use('/move-in', moveInProtocolsRoutes);
router.use('/move-out', moveOutProtocolsRoutes);

export default router;
