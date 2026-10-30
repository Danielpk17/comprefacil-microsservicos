const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const signature = ['', 'Equipe CompreFácil'];

export const templates = {
  'payment.requested': (data) => ({
    subject: `Recebemos o pagamento do pedido #${data.orderNumber}`,
    text: [
      'Olá!',
      '',
      `Recebemos a solicitação de pagamento do seu pedido #${data.orderNumber}, no valor de ${currency.format(data.amount)}.`,
      'Ela está em processamento e avisaremos assim que o pagamento for confirmado.',
      '',
      `Transação: ${data.transactionId}`,
      ...signature,
    ].join('\n'),
  }),
  'payment.confirmed': (data) => ({
    subject: `Pagamento confirmado: pedido #${data.orderNumber}`,
    text: [
      'Olá!',
      '',
      `O pagamento de ${currency.format(data.amount)} referente ao pedido #${data.orderNumber} foi confirmado.`,
      'Seu pedido já segue para a separação.',
      '',
      `Transação: ${data.transactionId}`,
      ...signature,
    ].join('\n'),
  }),
};
