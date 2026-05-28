import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false }, // NOSONAR - AWS RDS requiere SSL, certificado gestionado por AWS
});

// CAMBIO CLAVE: Usa export default en lugar de module.exports
export default pool;

// Si tienes la consulta de prueba al final, asegúrate de que no use require
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error conectando a la DB:', err.stack);
    } else {
        console.log('✅ Conexión establecida con la DB');
    }
});