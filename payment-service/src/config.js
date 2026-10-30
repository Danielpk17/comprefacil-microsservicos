export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5434/payment',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://comprefacil:comprefacil@localhost:5672',
  processingDelayMs: Number(process.env.PROCESSING_DELAY_MS ?? 3000),
  outboxIntervalMs: Number(process.env.OUTBOX_INTERVAL_MS ?? 1000),
};
