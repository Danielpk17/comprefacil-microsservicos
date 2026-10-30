const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isFilled = (value) => (typeof value === 'string' && value.trim() !== '') || Number.isInteger(value);

export const isUuid = (value) => UUID.test(value);

export function validatePaymentRequest(body) {
  const { userId, customerEmail, orderNumber, amount } = body ?? {};
  const errors = [];

  if (!isFilled(userId)) errors.push('userId é obrigatório');
  if (typeof customerEmail !== 'string' || !EMAIL.test(customerEmail.trim())) {
    errors.push('customerEmail deve ser um e-mail válido');
  }
  if (!isFilled(orderNumber)) errors.push('orderNumber é obrigatório');
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    errors.push('amount deve ser um número maior que zero');
  } else if (Number(amount.toFixed(2)) !== amount) {
    errors.push('amount aceita no máximo duas casas decimais');
  }

  if (errors.length > 0) return { errors };

  return {
    errors,
    value: {
      userId: String(userId).trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      orderNumber: String(orderNumber).trim(),
      amount,
    },
  };
}
