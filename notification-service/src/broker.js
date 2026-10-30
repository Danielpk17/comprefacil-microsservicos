import amqp from 'amqplib';
import { config } from './config.js';
import { logger } from './logger.js';

export const EXCHANGE = 'payments';
export const QUEUE = 'notification.payment-events';
export const ROUTING_KEYS = ['payment.requested', 'payment.confirmed'];

let connected = false;

const deadLetterTo = (queue) => ({
  'x-dead-letter-exchange': '',
  'x-dead-letter-routing-key': `${queue}.dlq`,
});

export function isBrokerReady() {
  return connected;
}

export async function connectBroker({ onPaymentEvent }) {
  const connection = await amqp.connect(config.rabbitmqUrl, {
    recovery: {
      waitForConnect: false,
      maxDelay: 10000,
      async setup(model) {
        const channel = await model.createChannel();
        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
        await channel.assertQueue(`${QUEUE}.dlq`, { durable: true });
        await channel.assertQueue(QUEUE, { durable: true, arguments: deadLetterTo(QUEUE) });
        for (const routingKey of ROUTING_KEYS) {
          await channel.bindQueue(QUEUE, EXCHANGE, routingKey);
        }
        await channel.prefetch(10);
        await channel.consume(QUEUE, (message) => handleDelivery(channel, message, onPaymentEvent));
      },
    },
  });

  connection.on('connect', () => {
    connected = true;
    logger.info(`Conectado ao RabbitMQ, consumindo a fila ${QUEUE}`);
  });
  connection.on('disconnect', (error) => {
    connected = false;
    logger.warn(`Conexão com o RabbitMQ perdida: ${error.message}`);
  });
  connection.on('reconnect-scheduled', ({ attempt, delay }) => {
    logger.warn(`RabbitMQ indisponível, tentativa ${attempt} em ${delay} ms`);
  });
  connection.on('error', (error) => logger.error('Erro na conexão AMQP', error.message));

  return connection;
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
