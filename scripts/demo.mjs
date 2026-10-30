const PAYMENT_URL = process.env.PAYMENT_URL ?? 'http://localhost:4000';
const NOTIFICATION_URL = process.env.NOTIFICATION_URL ?? 'http://localhost:4001';
const TIMEOUT_MS = 30000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const startedAt = Date.now();
const clock = () => `[+${((Date.now() - startedAt) / 1000).toFixed(1)}s]`;

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json' } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${url} respondeu ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const order = {
  userId: '10',
  customerEmail: 'cliente@comprefacil.com.br',
  orderNumber: String(Date.now()).slice(-6),
  amount: 259.9,
};

console.log(`${clock()} POST ${PAYMENT_URL}/payments`, order);
const created = await request(`${PAYMENT_URL}/payments`, { method: 'POST', body: JSON.stringify(order) });
console.log(`${clock()} 202 Accepted: transação ${created.id} registrada com status ${created.status}`);

let status = created.status;
const seen = new Set();

while (Date.now() - startedAt < TIMEOUT_MS && !(status === 'SUCCESS' && seen.size >= 2)) {
  await sleep(500);
  const transaction = await request(`${PAYMENT_URL}/payments/${created.id}`);
  if (transaction.status !== status) {
    status = transaction.status;
    console.log(`${clock()} payment-service: status da transação mudou para ${status}`);
  }
  const notifications = await request(`${NOTIFICATION_URL}/notifications?transactionId=${created.id}`);
  for (const notification of notifications.toReversed()) {
    if (seen.has(notification.id)) continue;
    seen.add(notification.id);
    console.log(`${clock()} notification-service: ${notification.eventType} -> "${notification.subject}" para ${notification.recipient}`);
  }
}

if (status === 'SUCCESS' && seen.size >= 2) {
  console.log(`${clock()} Fluxo completo. Veja os e-mails em http://localhost:8025`);
} else {
  console.error(`${clock()} Fluxo incompleto: status ${status}, ${seen.size} notificação(ões). Os dois serviços estão rodando?`);
  process.exit(1);
}
