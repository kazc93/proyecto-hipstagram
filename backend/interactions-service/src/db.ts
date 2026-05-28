import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Cargamos las variables de entorno
dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false },
});

// Mensaje de confirmación de conexión
pool.on('connect', () => {
    console.log('✅ Interaction-Service conectado a PostgreSQL');
});

// Exportación por defecto para que index.ts pueda importarlo como "import pool from './db'"
export default pool;

// Prueba de conexión inicial
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error de conexión en Interaction-Service:', err.stack);
    } else {
        console.log('🐘 Base de Datos lista para recibir likes y comentarios');
    }
});