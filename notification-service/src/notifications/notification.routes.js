import { Router } from 'express';
import { listNotifications } from './notification.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const notificationRoutes = Router();

notificationRoutes.get('/', async (req, res) => {
  const { transactionId, userId } = req.query;
  if (transactionId && !UUID.test(transactionId)) {
    return res.status(400).json({ error: 'transactionId deve ser um UUID' });
  }
  res.json(await listNotifications({ transactionId, userId }));
});
