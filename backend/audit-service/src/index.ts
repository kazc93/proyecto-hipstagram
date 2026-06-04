import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import pool from './config/db';
import verificarToken, { AuthRequest } from './authMiddleware';
import dotenv from 'dotenv';
import auditRoutes from './routes/auditRoutes';

dotenv.config();

const app: Application = express();

app.use(express.json());
app.use(cors());

// Rutas de escritura de logs de auditoría
app.use('/', auditRoutes);

// Consulta el historial de auditoría con filtros opcionales por usuario, acción y fecha
app.get(['/', '/audit'], verificarToken, async (req: AuthRequest, res: Response) => {
    if (req.user?.rol !== 'ADMIN') return res.status(403).send("No autorizado");

    const { usuario_id, accion, fecha, fecha_fin, result, page, limit } = req.query;
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
        params.push(`%${accion}%`);
        whereClause += ` AND accion ILIKE $${params.length}`;
    }
    if (result) {
        params.push(result);
        whereClause += ` AND a.result = $${params.length}`;
    }
    if (fecha && fecha_fin) {
        params.push(`${fecha} 00:00:00`);
        params.push(`${fecha_fin} 23:59:59`);
        whereClause += ` AND fecha_accion BETWEEN $${params.length - 1} AND $${params.length}`;
    } else if (fecha) {
        params.push(`${fecha}%`);
        whereClause += ` AND fecha_accion::text LIKE $${params.length}`;
    }

    try {
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id::text = u.id::text ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        params.push(limitNum);
        params.push(offset);
        const dataResult = await pool.query(
            `SELECT a.*, COALESCE(u.username, a.usuario_id::text) AS username
             FROM auditoria a
             LEFT JOIN usuarios u ON a.usuario_id::text = u.id::text
             ${whereClause}
             ORDER BY a.fecha_accion DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
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
