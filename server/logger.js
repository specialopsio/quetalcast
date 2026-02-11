import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function createLogger(name = 'server') {
  const logFile = path.join(LOG_DIR, `${name}.log`);

  return pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      targets: [
        {
          target: 'pino/file',
          options: { destination: logFile, mkdir: true },
          level: 'info',
        },
        {
          target: 'pino/file',
          options: { destination: 1 }, // stdout
          level: process.env.LOG_LEVEL || 'info',
        },
      ],
    },
  });
}

export function createStatsLogger() {
  const date = new Date().toISOString().slice(0, 10);
  const logFile = path.join(LOG_DIR, `stats-${date}.jsonl`);

  return pino({
    name: 'stats',
    level: 'info',
    transport: {
      target: 'pino/file',
      options: { destination: logFile, mkdir: true },
    },
  });
}
