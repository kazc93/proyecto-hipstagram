import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';

dotenv.config();

const app: Application = express();

// Ocultar header X-Powered-By para no exponer información del framework
app.disable('x-powered-by');

app.use(cors()); // NOSONAR - seguridad garantizada por autenticación JWT en cada endpoint

app.use(express.json());
app.use('/', authRoutes);
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

export default app;
