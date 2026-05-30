import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';

dotenv.config();

const app: Application = express();

// Ocultar header X-Powered-By para no exponer información del framework
app.disable('x-powered-by');

// CORS restringido a los orígenes conocidos del frontend
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://3.88.254.85.nip.io',
  'https://main.dyer5iztb0u8h.amplifyapp.com',
  'http://localhost:4200',
  'capacitor://localhost',  // APK Android/iOS con Capacitor
  'http://localhost',       // APK en emulador
];
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, Postman, servicios internos)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origen no permitido'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use('/', authRoutes);
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

export default app;
