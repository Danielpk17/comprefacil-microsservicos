import express from 'express';
import { connectBroker, isBrokerReady } from './broker.js';
import { config } from './config.js';
import { migrate, pool } from './database.js';
import { logger } from './logger.js';
import { notificationRoutes } from './notifications/notification.routes.js';
import { handlePaymentEvent } from './notifications/notification.service.js';

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  const database = await pool.query('SELECT 1').then(() => 'up', () => 'down');
  const broker = isBrokerReady() ? 'up' : 'down';
  res.status(database === 'up' ? 200 : 503).json({ service: 'notification-service', database, broker });
});

app.use('/notifications', notificationRoutes);

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  logger.error(`Erro em ${req.method} ${req.originalUrl}`, error.message);
  res.status(500).json({ error: 'Erro interno' });
});

await migrate();
const broker = await connectBroker({ onPaymentEvent: handlePaymentEvent });
const server = app.listen(config.port, () => logger.info(`API REST ouvindo em http://localhost:${config.port}`));

async function shutdown(signal) {
  logger.info(`${signal} recebido, encerrando o serviço`);
  server.close();
  await broker.close().catch(() => {});
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
