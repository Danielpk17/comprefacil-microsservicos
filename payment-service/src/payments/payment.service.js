import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { config } from '../config.js';
import { withTransaction } from '../database.js';
import { logger } from '../logger.js';
import { drainOutbox, enqueueEvent } from '../outbox.js';
import { insertTransaction, markAsSucceeded } from './payment.repository.js';

export const PAYMENT_REQUESTED = 'payment.requested';
export const PAYMENT_CONFIRMED = 'payment.confirmed';

function toEventData(transaction) {
  return {
    transactionId: transaction.id,
    userId: transaction.userId,
    customerEmail: transaction.customerEmail,
    orderNumber: transaction.orderNumber,
    amount: transaction.amount,
    status: transaction.status,
    createdAt: transaction.createdAt,
    confirmedAt: transaction.confirmedAt,
  };
}

export async function requestPayment(input) {
  const transaction = await withTransaction(async (client) => {
    const created = await insertTransaction(client, { id: randomUUID(), ...input, status: 'PENDING' });
    await enqueueEvent(client, PAYMENT_REQUESTED, toEventData(created));
    return created;
  });
  logger.info('Transação registrada com status PENDING', { transactionId: transaction.id, orderNumber: transaction.orderNumber });
  drainOutbox();
  return transaction;
}

export async function handlePaymentRequested(event) {
  const { transactionId } = event.data;
  logger.info(`Processando pagamento da transação ${transactionId}`);
  await simulateGatewayAuthorization();

  const confirmed = await withTransaction(async (client) => {
    const transaction = await markAsSucceeded(client, transactionId);
    if (transaction) await enqueueEvent(client, PAYMENT_CONFIRMED, toEventData(transaction));
    return transaction;
  });

  if (!confirmed) {
    logger.warn(`Transação ${transactionId} já confirmada ou inexistente, evento ignorado`);
    return;
  }
  logger.info('Transação confirmada com status SUCCESS', { transactionId, orderNumber: confirmed.orderNumber });
  drainOutbox();
}

function simulateGatewayAuthorization() {
  return sleep(config.processingDelayMs);
}
