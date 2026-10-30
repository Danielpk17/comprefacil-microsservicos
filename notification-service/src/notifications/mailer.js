import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: false,
  connectionTimeout: 10000,
});

export async function sendEmail({ to, subject, text }) {
  await transporter.sendMail({ from: config.mailFrom, to, subject, text });
}
