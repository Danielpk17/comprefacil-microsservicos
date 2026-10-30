const SERVICE = 'notification-service';

function write(level, message, details) {
  const line = `${new Date().toISOString()} ${level.padEnd(5)} [${SERVICE}] ${message}`;
  const output = level === 'ERROR' ? console.error : console.log;
  if (details === undefined) output(line);
  else output(line, details);
}

export const logger = {
  info: (message, details) => write('INFO', message, details),
  warn: (message, details) => write('WARN', message, details),
  error: (message, details) => write('ERROR', message, details),
};
