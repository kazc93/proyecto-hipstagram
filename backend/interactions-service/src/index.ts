import express, { Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import pool from './db';
import verificarToken, { AuthRequest } from './authMiddleware';
import * as dotenv from 'dotenv';
import { validateComment } from './helpers/commentValidation';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Registra o actualiza el voto de un usuario en una publicación
app.post('/voto', verificarToken, async (req: AuthRequest, res: Response) => {
    const { publicacion_id, tipo_voto } = req.body;
    const usuario_id = req.user?.id;

    try {
        await pool.query(
            `INSERT INTO votos (usuario_id, publicacion_id, tipo_voto)
             VALUES ($1, $2, $3)
             ON CONFLICT (usuario_id, publicacion_id)
             DO UPDATE SET tipo_voto = EXCLUDED.tipo_voto`,
            [usuario_id, publicacion_id, tipo_voto]
        );

        res.json({ message: "Voto registrado/actualizado correctamente" });

        axios.post('http://audit-service:3003/log', {
            usuario_id,
            accion: 'VOTO_PUBLICACION',
            detalles: `Usuario votó ${tipo_voto === 1 ? 'like' : 'dislike'} en post ${publicacion_id}`,
            ip_origen: req.ip,
            actor_role: req.user?.rol || 'USER',
            entity_type: 'POST',
            entity_id: publicacion_id,
            result: 'EXITO'
        }).catch(err => console.error("Error en auditoría:", err.message));

    } catch (err: any) {
        console.error("❌ Error de BD al votar:", err.message);
        res.status(500).json({ error: "Error al procesar el voto" });
    }
});

// Valida y guarda un comentario en una publicación
app.post('/comentar', verificarToken, async (req: AuthRequest, res: Response) => {
    const { publicacion_id, texto } = req.body;
    const usuario_id = req.user?.id;

    const validation = validateComment(texto);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    console.log(`📝 Recibiendo comentario: "${texto}" para post: ${publicacion_id}`);

    try {
        const nuevoComentario = await pool.query(
            "INSERT INTO comentarios (usuario_id, publicacion_id, texto) VALUES ($1, $2, $3) RETURNING *",
            [usuario_id, publicacion_id, texto]
        );

        res.json(nuevoComentario.rows[0]);

        axios.post('http://audit-service:3003/log', {
            usuario_id,
            accion: 'COMENTAR_POST',
            detalles: `Usuario comentó: ${texto.substring(0, 30)}...`,
            ip_origen: req.ip,
            actor_role: req.user?.rol || 'USER',
            entity_type: 'COMENTARIO',
            entity_id: nuevoComentario.rows[0].id,
            result: 'EXITO'
        }).catch(err => console.error("Error en auditoría:", err.message));

    } catch (err: any) {
        console.error("❌ Error de BD al guardar comentario:", err.message);
        res.status(500).json({ error: "Error al guardar comentario" });
    }
});

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
    console.log(`💬 Interaction-Service en TS corriendo en puerto ${PORT}`);
});
