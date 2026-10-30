import { pool } from '../database.js';

const COLUMNS = 'id, user_id, customer_email, order_number, amount, status, created_at, updated_at, confirmed_at';

function toTransaction(row) {
  return {
    id: row.id,
    userId: row.user_id,
    customerEmail: row.customer_email,
    orderNumber: row.order_number,
    amount: Number(row.amount),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
  };
}

export async function insertTransaction(db, transaction) {
  const { rows } = await db.query(
    `INSERT INTO transactions (id, user_id, customer_email, order_number, amount, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [
      transaction.id,
      transaction.userId,
      transaction.customerEmail,
      transaction.orderNumber,
      transaction.amount,
      transaction.status,
    ],
  );
  return toTransaction(rows[0]);
}

export async function markAsSucceeded(db, id) {
  const { rows } = await db.query(
    `UPDATE transactions
        SET status = 'SUCCESS', confirmed_at = now(), updated_at = now()
      WHERE id = $1 AND status = 'PENDING'
      RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ? toTransaction(rows[0]) : null;
}

export async function findTransactionById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM transactions WHERE id = $1`, [id]);
  return rows[0] ? toTransaction(rows[0]) : null;
}

export async function listTransactions({ userId } = {}, db = pool) {
  const { rows } = userId
    ? await db.query(`SELECT ${COLUMNS} FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, [userId])
    : await db.query(`SELECT ${COLUMNS} FROM transactions ORDER BY created_at DESC LIMIT 100`);
  return rows.map(toTransaction);
}
