export const config = {
  port: Number(process.env.PORT ?? 4001),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5434/notification',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://comprefacil:comprefacil@localhost:5672',
  smtpHost: process.env.SMTP_HOST ?? '127.0.0.1',
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  mailFrom: process.env.MAIL_FROM ?? 'CompreFácil <nao-responda@comprefacil.com.br>',
};
