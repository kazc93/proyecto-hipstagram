import { Router } from 'express';
import { register, login, refresh, resetPassword } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/reset-password', resetPassword);
export default router;