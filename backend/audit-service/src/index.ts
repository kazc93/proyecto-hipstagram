// src/index.ts
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import pool from './config/db';
import verificarToken, { AuthRequest } from './authMiddleware';
import dotenv from 'dotenv';
import auditRoutes from './routes/auditRoutes';

// Cargar variables de entorno
dotenv.config();

const app: Application = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Rutas 
app.use('/', auditRoutes);

// --- RUTA ÚNICA: OBTENER LOGS DE AUDITORÍA CON FILTROS ---
app.get(['/', '/audit'], verificarToken, async (req: AuthRequest, res: Response) => {
    if (req.user?.rol !== 'ADMIN') return res.status(403).send("No autorizado");

    const { usuario_id, accion, fecha, page, limit } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (usuario_id) {
        params.push(usuario_id);
        whereClause += ` AND usuario_id = $${params.length}`;
    }
    if (accion) {
        params.push(accion);
        whereClause += ` AND accion = $${params.length}`;
    }
    if (fecha) {
        params.push(`${fecha}%`);
        whereClause += ` AND fecha_accion::text LIKE $${params.length}`;
    }

    try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM auditoria ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        params.push(limitNum);
        params.push(offset);
        const dataResult = await pool.query(
            `SELECT * FROM auditoria ${whereClause} ORDER BY fecha_accion DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({
            data: dataResult.rows,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            limit: limitNum
        });
    } catch (err: any) {
        console.error("Error obteniendo auditoría filtrada:", err.message);
        res.status(500).json({ error: "Error interno al obtener los logs" });
    }
});

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
    console.log(`🚀 Audit Service en TypeScript corriendo en puerto ${PORT}`);
});