import { randomUUID } from 'node:crypto';
import { withTransaction } from '../database.js';
import { logger } from '../logger.js';
import { sendEmail } from './mailer.js';
import { insertNotification } from './notification.repository.js';
import { templates } from './notification.templates.js';

export async function handlePaymentEvent(event) {
  const template = templates[event.type];
  if (!template) {
    logger.warn(`Evento ${event.type} sem template de notificação, ignorado`);
    return;
  }

  const { data } = event;
  const message = template(data);

  const notification = await withTransaction(async (client) => {
    const saved = await insertNotification(client, {
      id: randomUUID(),
      eventId: event.eventId,
      eventType: event.type,
      transactionId: data.transactionId,
      userId: data.userId,
      channel: 'EMAIL',
      recipient: data.customerEmail,
      subject: message.subject,
      body: message.text,
    });
    if (saved) await sendEmail({ to: saved.recipient, subject: saved.subject, text: saved.body });
    return saved;
  });

  if (!notification) {
    logger.info(`Evento ${event.eventId} já notificado anteriormente, ignorado`);
    return;
  }
  logger.info(`E-mail "${notification.subject}" enviado para ${notification.recipient}`, {
    eventType: event.type,
    transactionId: data.transactionId,
  });
}
