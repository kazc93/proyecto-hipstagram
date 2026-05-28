import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false }, // NOSONAR - AWS RDS requiere SSL, certificado gestionado por AWS
});

pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL en el puerto', process.env.DB_PORT);
});

export default pool;