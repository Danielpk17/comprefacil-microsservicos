import { Router } from 'express';
import { findTransactionById, listTransactions } from './payment.repository.js';
import { requestPayment } from './payment.service.js';
import { isUuid, validatePaymentRequest } from './payment.validation.js';

export const paymentRoutes = Router();

paymentRoutes.post('/', async (req, res) => {
  const { errors, value } = validatePaymentRequest(req.body);
  if (errors.length > 0) return res.status(400).json({ errors });

  const transaction = await requestPayment(value);
  res.status(202).location(`/payments/${transaction.id}`).json(transaction);
});

paymentRoutes.get('/', async (req, res) => {
  res.json(await listTransactions({ userId: req.query.userId }));
});

paymentRoutes.get('/:id', async (req, res) => {
  const transaction = isUuid(req.params.id) ? await findTransactionById(req.params.id) : null;
  if (!transaction) return res.status(404).json({ error: 'Transação não encontrada' });
  res.json(transaction);
});
