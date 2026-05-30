import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';

dotenv.config();

const app: Application = express();
app.use(express.json());
app.use(cors());
app.use('/', authRoutes);
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

export default app;
