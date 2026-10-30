import { randomUUID } from 'node:crypto';
import { isBrokerReady, publish } from './broker.js';
import { withTransaction } from './database.js';
import { logger } from './logger.js';

let draining = false;
let drainAgain = false;

export async function enqueueEvent(client, routingKey, data) {
  const event = {
    eventId: randomUUID(),
    type: routingKey,
    occurredAt: new Date().toISOString(),
    data,
  };
  await client.query('INSERT INTO outbox (id, routing_key, payload) VALUES ($1, $2, $3)', [
    event.eventId,
    routingKey,
    event,
  ]);
  return event;
}

export async function drainOutbox() {
  if (draining) {
    drainAgain = true;
    return;
  }
  if (!isBrokerReady()) return;
  draining = true;
  try {
    do {
      drainAgain = false;
      await publishPendingEvents();
    } while (drainAgain);
  } catch (error) {
    logger.error('Falha ao publicar eventos do outbox, nova tentativa no próximo ciclo', error.message);
  } finally {
    draining = false;
  }
}

export function startOutboxRelay(intervalMs) {
  const timer = setInterval(drainOutbox, intervalMs);
  return () => clearInterval(timer);
}

async function publishPendingEvents() {
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, routing_key, payload
         FROM outbox
        WHERE published_at IS NULL
        ORDER BY created_at
        LIMIT 100
        FOR UPDATE SKIP LOCKED`,
    );
    for (const row of rows) {
      await publish(row.routing_key, row.payload);
      await client.query('UPDATE outbox SET published_at = now() WHERE id = $1', [row.id]);
      logger.info(`Evento ${row.routing_key} publicado no RabbitMQ`, {
        eventId: row.id,
        transactionId: row.payload.data.transactionId,
      });
    }
  });
}
