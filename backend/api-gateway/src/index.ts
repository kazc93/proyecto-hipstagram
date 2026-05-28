import express from 'express';
import cors, { CorsOptions } from 'cors'; 
import proxy from 'express-http-proxy';
import * as dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const app: express.Application = express();

// CONFIGURACIÓN DE CORS
const corsOptions: CorsOptions = {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'], // Permitimos el header nuevo
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// ==========================================
// MIDDLEWARE DE TRAZABILIDAD (EL GAFETE)
// ==========================================
app.use((req, res, next) => {
    // Genera un ID único para cada petición que entra
    const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID(); // Si el cliente ya envió uno, lo usamos; si no, generamos uno nuevo
    req.headers['x-correlation-id'] = correlationId; // Se lo pega a la petición
    
    console.log(`[TraceID: ${correlationId}] Petición Entrante Gateway: ${req.method} ${req.url}`);
    
    next();
});
// ==========================================

// MAPEO DE RUTAS (PROXIES) ACTUALIZADO
// El proxy enviará automáticamente el 'x-correlation-id' a las oficinas de arriba
app.use('/auth', proxy('http://auth-service:3001'));
app.use('/users', proxy('http://user-service:3006'));
app.use('/interactions', proxy('http://interactions-service:3004'));

app.use('/posts', proxy('http://post-service:3002', {
    limit: '50mb',
    proxyReqPathResolver: (req) => (req.url === '' || req.url === '/') ? '/' : req.url
}));

app.use('/media', proxy('http://media-service:3007', {
    limit: '50mb',
    proxyReqPathResolver: (req) => (req.url === '' || req.url === '/') ? '/' : req.url
}));

app.use('/search', proxy('http://search-service:3005', {
    proxyReqPathResolver: (req) => req.url
}));

app.use('/audit', proxy('http://audit-service:3003', {
    proxyReqPathResolver: (req) => (req.url === '' || req.url === '/') ? '/' : req.url
}));

app.use('/moderation', proxy('http://moderation-service:3008', {
    proxyReqPathResolver: (req) => (req.url === '' || req.url === '/') ? '/' : req.url
}));

// --- HEALTH CHECK DEL GATEWAY ---
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'api-gateway', timestamp: new Date() });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🌐 API Gateway en TypeScript corriendo en puerto ${PORT}`);
    console.log(`🔗 Enrutando peticiones a los microservicios del ecosistema Hipstagram`);
});