import pg from 'pg';
import { env } from '../config/env.js';
if (!env.databaseUrl) throw new Error('Configurar DATABASE_URL en .env');
export const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 10 });
