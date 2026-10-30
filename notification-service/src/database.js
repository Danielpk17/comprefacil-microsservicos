import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

pool.on('error', (error) => logger.error('Erro em conexão ociosa do Postgres', error.message));

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate({ attempts = 15, delayMs = 2000 } = {}) {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query(schema);
      logger.info('Schema do banco notification pronto');
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      logger.warn(`Postgres indisponível (${error.code ?? error.message}), nova tentativa em ${delayMs} ms`);
      await sleep(delayMs);
    }
  }
}
