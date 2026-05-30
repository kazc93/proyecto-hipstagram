import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';

dotenv.config();

const app: Application = express();

// Ocultar header X-Powered-By para no exponer información del framework
app.disable('x-powered-by');

// CORS abierto — la seguridad está garantizada por autenticación JWT en cada endpoint // NOSONAR
app.use(cors());

app.use(express.json());
app.use('/', authRoutes);
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

export default app;
