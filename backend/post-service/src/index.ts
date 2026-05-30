import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import axios from 'axios';
import pool from './db';
import verificarToken, { AuthRequest } from './authMiddleware';
import * as dotenv from 'dotenv';
import AWS from 'aws-sdk';
import { extractHashtags } from './helpers/hashtagParser';

dotenv.config();

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const app = express();
app.use(express.json());
app.use(cors());

// Imprime el ID de trazabilidad en cada petición entrante
app.use((req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || 'SIN-RASTREO';
    console.log(`[TraceID: ${correlationId}] Ejecutando Post-Service: ${req.method} ${req.url}`);
    next();
});

app.use('/uploads', express.static('uploads'));

// Usa almacenamiento en S3 si hay credenciales configuradas, de lo contrario guarda en disco
const useS3 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_BUCKET_NAME);

const storage = useS3
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: 'uploads/',
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
    });
const upload = multer({ storage });

// Sube una imagen, modera el contenido, extrae hashtags y crea la publicación
app.post('/upload', verificarToken, upload.single('image'), async (req: AuthRequest, res: Response) => {
    const { descripcion } = req.body;
    const usuario_id = req.user?.id;

    if (!req.file) return res.status(400).send("No se subió ninguna imagen");

    try {
        const s3FileName = `${Date.now()}-${req.file.originalname}`;

        // Sube la imagen a S3 o guarda localmente según la configuración
        let imageUrl: string;
        if (useS3) {
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME!,
                Key: s3FileName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype
            };
            const s3Response = await s3.upload(params).promise();
            imageUrl = s3Response.Location;
        } else {
            const filename = (req.file as Express.Multer.File & { filename: string }).filename;
            imageUrl = `${process.env.PUBLIC_URL || 'https://54.234.8.66.nip.io'}/posts/uploads/${filename}`;
        }

        // Envía texto e imagen al moderation-service para validar el contenido
        let estadoInicial = 'APROBADO';
        try {
            const modResponse = await axios.post('http://moderation-service:3008/check', {
                text: descripcion,
                imageUrl: imageUrl,
                key: s3FileName
            }, {
                headers: { 'x-correlation-id': req.headers['x-correlation-id'] || 'SIN-RASTREO' }
            });

            estadoInicial = modResponse.data.clean ? 'APROBADO' : 'PENDIENTE';

            if (!modResponse.data.clean) {
                console.log(`[TraceID: ${req.headers['x-correlation-id']}] Post marcado como PENDIENTE. Razón:`, modResponse.data.details);
            }
        } catch (e: any) {
            console.error("⚠️ Error llamando a Moderación (Check):", e.message);
        }

        // Guarda la publicación en la base de datos con su estado de moderación
        const result = await pool.query(
            "INSERT INTO publicaciones (usuario_id, url_imagen, descripcion, estado_moderacion) VALUES ($1, $2, $3, $4) RETURNING *",
            [usuario_id, imageUrl, descripcion, estadoInicial]
        );
        const nuevaPublicacion = result.rows[0];

        // Extrae y asocia los hashtags de la descripción a la publicación
        const hashtags = extractHashtags(descripcion);

        if (hashtags.length > 0) {
            for (const tag of hashtags) {
                await pool.query(
                    "INSERT INTO hashtags (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING",
                    [tag]
                );
                const tagResult = await pool.query("SELECT id FROM hashtags WHERE nombre = $1", [tag]);
                const tagId = tagResult.rows[0].id;
                await pool.query(
                    "INSERT INTO publicaciones_hashtags (publicacion_id, hashtag_id) VALUES ($1, $2)",
                    [nuevaPublicacion.id, tagId]
                );
            }
        }

        const msg = estadoInicial === 'APROBADO' ? "Publicación creada exitosamente" : "Post en revisión por contenido";
        res.status(201).json({ message: msg, post: nuevaPublicacion });

        axios.post('http://audit-service:3003/log', {
            usuario_id,
            accion: 'CREAR_POST',
            detalles: `Post creado con ID: ${nuevaPublicacion.id}. Estado: ${estadoInicial}`,
            ip_origen: req.ip
        }).catch(e => console.error("⚠️ Error en auditoría:", e.message));

    } catch (err: any) {
        console.error("Error crítico:", err);
        res.status(500).json({ error: "Fallo en la subida a S3 o Base de Datos" });
    }
});

// Devuelve el feed paginado ordenado por hashtags, likes y fecha (solo posts aprobados)
app.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT
                p.id,
                p.usuario_id,
                p.url_imagen,
                p.descripcion,
                p.fecha_publicacion,
                u.username,
                COALESCE((SELECT SUM(tipo_voto) FROM votos WHERE publicacion_id = p.id), 0) AS likes,
                COALESCE((
                    SELECT json_agg(json_build_object('texto', c.texto, 'username', cu.username))
                    FROM comentarios c
                    JOIN usuarios cu ON c.usuario_id = cu.id
                    WHERE c.publicacion_id = p.id
                ), '[]'::json) AS comentarios,
                COALESCE((
                    SELECT json_agg(h.nombre ORDER BY h.nombre)
                    FROM publicaciones_hashtags ph
                    JOIN hashtags h ON ph.hashtag_id = h.id
                    WHERE ph.publicacion_id = p.id
                ), '[]'::json) AS hashtags
            FROM publicaciones p
            LEFT JOIN usuarios u ON p.usuario_id = u.id
            WHERE p.estado_moderacion = 'APROBADO'
            ORDER BY
                EXISTS(SELECT 1 FROM publicaciones_hashtags WHERE publicacion_id = p.id) DESC,
                COALESCE((SELECT SUM(tipo_voto) FROM votos WHERE publicacion_id = p.id), 0) DESC,
                p.fecha_publicacion DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        res.json({ page, limit, data: result.rows });
    } catch (err: any) {
        console.error("Error al obtener feed:", err);
        res.status(500).json({ error: "No se pudo cargar el feed" });
    }
});

// Devuelve el feed de exploración paginado ordenado exclusivamente por popularidad
app.get('/explore', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 15;
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT
                p.id,
                p.usuario_id,
                p.url_imagen,
                p.descripcion,
                p.fecha_publicacion,
                u.username,
                COALESCE((SELECT SUM(tipo_voto) FROM votos WHERE publicacion_id = p.id), 0) AS likes
            FROM publicaciones p
            LEFT JOIN usuarios u ON p.usuario_id = u.id
            WHERE p.estado_moderacion = 'APROBADO'
            ORDER BY
                likes DESC,
                p.fecha_publicacion DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        res.json({ page, limit, data: result.rows });
    } catch (err: any) {
        console.error("Error al obtener explorar:", err);
        res.status(500).json({ error: "No se pudo cargar explorar" });
    }
});

// Devuelve los comentarios paginados de una publicación específica
app.get('/:id/comments', async (req, res) => {
    try {
        const postId = req.params.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT c.texto, c.usuario_id, u.username
            FROM comentarios c
            JOIN usuarios u ON c.usuario_id = u.id
            WHERE c.publicacion_id = $1::uuid
            ORDER BY c.texto DESC
            LIMIT $2 OFFSET $3
        `, [postId, limit, offset]);

        const countResult = await pool.query(`SELECT COUNT(*) FROM comentarios WHERE publicacion_id = $1::uuid`, [postId]);
        const total = parseInt(countResult.rows[0].count);

        res.json({ page, limit, total, data: result.rows });
    } catch (err: any) {
        console.error("Error al obtener comentarios:", err);
        res.status(500).json({ error: "No se pudieron cargar los comentarios" });
    }
});

// Devuelve las publicaciones aprobadas de un usuario para su perfil
app.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 12;
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT
                p.id,
                p.usuario_id,
                p.url_imagen,
                p.descripcion,
                p.fecha_publicacion,
                COALESCE((SELECT SUM(tipo_voto) FROM votos WHERE publicacion_id = p.id), 0) AS likes,
                COALESCE((SELECT COUNT(*) FROM comentarios WHERE publicacion_id = p.id), 0) AS total_comentarios
            FROM publicaciones p
            WHERE p.usuario_id = $1::uuid AND p.estado_moderacion = 'APROBADO'
            ORDER BY p.fecha_publicacion DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        const countResult = await pool.query(`
            SELECT COUNT(*) FROM publicaciones
            WHERE usuario_id = $1::uuid AND estado_moderacion = 'APROBADO'
        `, [userId]);

        const total = parseInt(countResult.rows[0].count);

        res.json({ page, limit, total, data: result.rows });
    } catch (err: any) {
        console.error("Error al obtener publicaciones del perfil:", err);
        res.status(500).json({ error: "No se pudieron cargar las publicaciones del perfil" });
    }
});

// Elimina una publicación solo si pertenece al usuario autenticado
app.delete('/delete/:id', verificarToken, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const usuario_id = req.user?.id != null ? String(req.user.id) : undefined;
    if (!usuario_id) {
        return res.status(401).json({ message: "Usuario no identificado en el token" });
    }

    try {
        const result = await pool.query(
            `DELETE FROM publicaciones
             WHERE id = $1::uuid AND usuario_id = $2::uuid
             RETURNING *`,
            [id, usuario_id]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ message: "No autorizado o no existe" });
        }

        res.json({ message: "Publicación eliminada" });

        axios.post('http://audit-service:3003/log', {
            usuario_id,
            accion: 'ELIMINAR_POST',
            detalles: `Eliminado post: ${id}`,
            ip_origen: req.ip
        }).catch(e => console.error(e.message));

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Devuelve todas las publicaciones para el panel de moderación (solo ADMIN)
app.get('/admin/moderation', verificarToken, async (req: AuthRequest, res: Response) => {
    if (req.user?.rol !== 'ADMIN') return res.status(403).json({ message: "Acceso denegado" });

    try {
        const result = await pool.query(`
            SELECT p.id, p.url_imagen, p.descripcion, p.fecha_publicacion, p.estado_moderacion, u.username
            FROM publicaciones p
            JOIN usuarios u ON p.usuario_id = u.id
            ORDER BY p.fecha_publicacion DESC
        `);
        res.json(result.rows);
    } catch (err: any) {
        console.error("Error al obtener publicaciones:", err);
        res.status(500).json({ error: "Error al obtener el historial de publicaciones" });
    }
});

// Cambia el estado de moderación de una publicación (solo ADMIN)
app.put('/admin/moderation/:id', verificarToken, async (req: AuthRequest, res: Response) => {
    if (req.user?.rol !== 'ADMIN') return res.status(403).json({ message: "Acceso denegado" });

    const { estado } = req.body;
    const postId = req.params.id;

    try {
        await pool.query(
            "UPDATE publicaciones SET estado_moderacion = $1 WHERE id = $2",
            [estado, postId]
        );

        res.json({ message: `Publicación marcada como ${estado}` });

        axios.post('http://audit-service:3003/log', {
            usuario_id: req.user.id,
            accion: `POST_${estado}`,
            detalles: `Admin cambió el estado del post ${postId} a ${estado}`,
            ip_origen: req.ip
        }).catch(err => console.error("Error enviando a auditoría:", err.message));

    } catch (err: any) {
        res.status(500).json({ error: "Error al actualizar el estado de la publicación" });
    }
});

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`📸 Post-Service corriendo en puerto ${PORT}`));
