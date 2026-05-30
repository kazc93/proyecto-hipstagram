import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import verificarToken, { AuthRequest } from './authMiddleware';
import * as dotenv from 'dotenv';
import AWS from 'aws-sdk';

const AUDIT_URL = process.env.AUDIT_SERVICE_URL || 'http://audit-service:3003/log';

// Envía evento de auditoría de forma asíncrona
const logAudit = (usuario_id: string, accion: string, detalles: string, extras: object, correlationId?: string) => {
    axios.post(AUDIT_URL, { usuario_id, accion, detalles, ip_origen: 'moderation-service', ...extras },
        { headers: { 'x-correlation-id': correlationId || 'SIN-RASTREO' } }
    ).catch(e => console.error('⚠️ Error en auditoría:', e.message));
};

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Configura el cliente de AWS Rekognition para análisis de imágenes
const rekognition = new AWS.Rekognition({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

const FILE_PATH = path.join(__dirname, 'bannedWords.json');

// Lee la lista de palabras prohibidas desde el archivo JSON
const readWords = (): string[] => {
    if (!fs.existsSync(FILE_PATH)) {
        fs.writeFileSync(FILE_PATH, JSON.stringify(['spam', 'fraude', 'insulto_ejemplo']));
    }
    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(data);
};

// Persiste la lista de palabras prohibidas en el archivo JSON
const writeWords = (words: string[]) => {
    fs.writeFileSync(FILE_PATH, JSON.stringify(words, null, 2));
};

// Devuelve la lista actual de palabras prohibidas (solo ADMIN)
app.get('/words', verificarToken, (req: AuthRequest, res: Response) => {
    if (req.user?.rol !== 'ADMIN') return res.status(403).json({ message: "Acceso denegado" });
    res.json(readWords());
});

// Agrega una nueva palabra a la lista de palabras prohibidas (solo ADMIN)
app.post('/words', verificarToken, (req: AuthRequest, res: Response) => {
    if (req.user?.rol !== 'ADMIN') return res.status(403).json({ message: "Acceso denegado" });
    const { palabra } = req.body;
    if (!palabra) return res.status(400).json({ message: "La palabra es requerida" });
    const words = readWords();
    const lowerWord = String(palabra).toLowerCase().trim();
    if (!words.includes(lowerWord)) {
        words.push(lowerWord);
        writeWords(words);
    }
    res.json({ message: "Palabra agregada", palabras: words });

    logAudit(req.user!.id, 'AGREGAR_PALABRA_PROHIBIDA', `Admin agregó palabra: "${lowerWord}"`,
        { actor_role: 'ADMIN', entity_type: 'PALABRA_PROHIBIDA', entity_id: lowerWord, result: 'EXITO' },
        req.headers['x-correlation-id'] as string);
});

// Elimina una palabra de la lista de palabras prohibidas (solo ADMIN)
app.delete('/words/:word', verificarToken, (req: AuthRequest, res: Response) => {
    if (req.user?.rol !== 'ADMIN') return res.status(403).json({ message: "Acceso denegado" });
    const wordToDelete = String(req.params.word).toLowerCase();
    let words = readWords();
    words = words.filter(w => w !== wordToDelete);
    writeWords(words);
    res.json({ message: "Palabra eliminada", palabras: words });

    logAudit(req.user!.id, 'ELIMINAR_PALABRA_PROHIBIDA', `Admin eliminó palabra: "${wordToDelete}"`,
        { actor_role: 'ADMIN', entity_type: 'PALABRA_PROHIBIDA', entity_id: wordToDelete, result: 'EXITO' },
        req.headers['x-correlation-id'] as string);
});

// Imprime el ID de trazabilidad en cada petición entrante
app.use((req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || 'SIN-RASTREO';
    console.log(`[TraceID: ${correlationId}] Ejecutando Moderation-Service: ${req.method} ${req.url}`);
    next();
});

// Evalúa el texto e imagen de un post aplicando filtro de palabras y análisis con Rekognition
app.post(['/check', '/moderation/check'], async (req: Request, res: Response) => {
    const { text, imageUrl, key } = req.body;
    const correlationId = req.headers['x-correlation-id'] || 'SIN-RASTREO';

    console.log(`[TraceID: ${correlationId}] --- PROCESO DE MODERACIÓN ---`);

    let isClean = true;
    let details: string[] = [];

    // Moderación de texto: busca coincidencias contra la lista de palabras prohibidas
    if (text) {
        const bannedWords = readWords();
        const lowerText = String(text).toLowerCase();
        const badWordFound = bannedWords.find((banned: string) => lowerText.includes(banned.toLowerCase().trim()));

        if (badWordFound) {
            console.log(`[TraceID: ${correlationId}] ⚠️ BLOQUEADO TEXTO: Se encontró [${badWordFound}]`);
            isClean = false;
            details.push(`Palabra prohibida encontrada: ${badWordFound}`);
        }
    }

    // Moderación de imagen: analiza el contenido visual con AWS Rekognition
    if (isClean && imageUrl && imageUrl.includes('amazonaws.com') && process.env.AWS_BUCKET_NAME) {
        try {
            const s3ObjectName = key || imageUrl.split('/').pop();

            console.log(`[TraceID: ${correlationId}] Analizando imagen en AWS S3: ${s3ObjectName}`);

            const params = {
                Image: {
                    S3Object: {
                        Bucket: process.env.AWS_BUCKET_NAME,
                        Name: s3ObjectName
                    }
                },
                MinConfidence: 75
            };

            const response = await rekognition.detectModerationLabels(params).promise();

            if (response.ModerationLabels && response.ModerationLabels.length > 0) {
                console.log(`[TraceID: ${correlationId}] 🚨 BLOQUEADO IMAGEN: AWS detectó contenido inapropiado:`, response.ModerationLabels);
                isClean = false;
                details.push(`Contenido visual reportado por IA: ${response.ModerationLabels[0].Name}`);
            } else {
                console.log(`[TraceID: ${correlationId}] ✅ IMAGEN LIMPIA según AWS`);
            }
        } catch (error: any) {
            console.error(`[TraceID: ${correlationId}] ❌ Error conectando con AWS Rekognition:`, error.message);
            details.push('Error al analizar la imagen con IA');
        }
    }

    res.json({ clean: isClean, details });
});

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => {
    console.log(`🛡️ Moderation-Service corriendo en puerto ${PORT}`);
});
