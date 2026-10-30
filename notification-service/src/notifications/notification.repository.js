import { pool } from '../database.js';

const COLUMNS = 'id, event_id, event_type, transaction_id, user_id, channel, recipient, subject, body, sent_at';

function toNotification(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    eventType: row.event_type,
    transactionId: row.transaction_id,
    userId: row.user_id,
    channel: row.channel,
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    sentAt: row.sent_at,
  };
}

export async function insertNotification(db, notification) {
  const { rows } = await db.query(
    `INSERT INTO notifications (id, event_id, event_type, transaction_id, user_id, channel, recipient, subject, body)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING ${COLUMNS}`,
    [
      notification.id,
      notification.eventId,
      notification.eventType,
      notification.transactionId,
      notification.userId,
      notification.channel,
      notification.recipient,
      notification.subject,
      notification.body,
    ],
  );
  return rows[0] ? toNotification(rows[0]) : null;
}

export async function listNotifications({ transactionId, userId } = {}, db = pool) {
  const filters = [];
  const values = [];
  if (transactionId) {
    values.push(transactionId);
    filters.push(`transaction_id = $${values.length}`);
  }
  if (userId) {
    values.push(userId);
    filters.push(`user_id = $${values.length}`);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM notifications ${where} ORDER BY sent_at DESC LIMIT 100`,
    values,
  );
  return rows.map(toNotification);
}
