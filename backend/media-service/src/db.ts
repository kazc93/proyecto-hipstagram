import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// 1. CARGAR VARIABLES DE ENTORNO
dotenv.config();

// 2. CONFIGURACIÓN DEL POOL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    // Convertimos a entero ya que process.env siempre devuelve strings
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false },
});

pool.on('connect', () => {
    console.log('✅ Media-Service conectado a PostgreSQL');
});

// 3. EXPORTACIÓN POR DEFECTO
export default pool;

// 4. PRUEBA DE CONEXIÓN INICIAL
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error de conexión en Media-Service:', err.stack);
    } else {
        console.log('🐘 Conexión establecida: Base de datos del Media-Service lista');
    }
});