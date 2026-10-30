import amqp from 'amqplib';
import { config } from './config.js';
import { logger } from './logger.js';

export const EXCHANGE = 'payments';
export const PROCESSING_QUEUE = 'payment.processing';

let publishChannel = null;

const deadLetterTo = (queue) => ({
  'x-dead-letter-exchange': '',
  'x-dead-letter-routing-key': `${queue}.dlq`,
});

export function isBrokerReady() {
  return publishChannel !== null;
}

export async function connectBroker({ onPaymentRequested, onConnected }) {
  const connection = await amqp.connect(config.rabbitmqUrl, {
    recovery: {
      waitForConnect: false,
      maxDelay: 10000,
      async setup(model) {
        const channel = await model.createConfirmChannel();
        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
        await channel.assertQueue(`${PROCESSING_QUEUE}.dlq`, { durable: true });
        await channel.assertQueue(PROCESSING_QUEUE, { durable: true, arguments: deadLetterTo(PROCESSING_QUEUE) });
        await channel.bindQueue(PROCESSING_QUEUE, EXCHANGE, 'payment.requested');

        const consumer = await model.createChannel();
        await consumer.prefetch(5);
        await consumer.consume(PROCESSING_QUEUE, (message) => handleDelivery(consumer, message, onPaymentRequested));

        publishChannel = channel;
      },
    },
  });

  connection.on('connect', () => {
    logger.info(`Conectado ao RabbitMQ, consumindo a fila ${PROCESSING_QUEUE}`);
    onConnected();
  });
  connection.on('disconnect', (error) => {
    publishChannel = null;
    logger.warn(`Conexão com o RabbitMQ perdida: ${error.message}`);
  });
  connection.on('reconnect-scheduled', ({ attempt, delay }) => {
    logger.warn(`RabbitMQ indisponível, tentativa ${attempt} em ${delay} ms`);
  });
  connection.on('error', (error) => logger.error('Erro na conexão AMQP', error.message));

  return connection;
}

export function publish(routingKey, event) {
  if (!publishChannel) return Promise.reject(new Error('RabbitMQ indisponível'));
  const channel = publishChannel;
  const content = Buffer.from(JSON.stringify(event));
  const options = {
    persistent: true,
    contentType: 'application/json',
    messageId: event.eventId,
    type: routingKey,
    timestamp: Math.floor(Date.parse(event.occurredAt) / 1000),
  };
  return new Promise((resolve, reject) => {
    channel.publish(EXCHANGE, routingKey, content, options, (error) => (error ? reject(error) : resolve()));
  });
}

async function handleDelivery(channel, message, handler) {
  if (!message) return;
  try {
    await handler(JSON.parse(message.content.toString()));
    channel.ack(message);
  } catch (error) {
    const requeue = !message.fields.redelivered;
    logger.error(
      `Falha ao processar ${message.fields.routingKey}, ${requeue ? 'devolvendo para a fila' : 'enviando para a DLQ'}`,
      error.message,
    );
    try {
      channel.nack(message, false, requeue);
    } catch (nackError) {
      logger.warn(`Não foi possível devolver a mensagem: ${nackError.message}`);
    }
  }
}
