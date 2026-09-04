import { createHash } from 'crypto';

export function hashOrigin(value) {
  const salt = process.env.LOG_SALT || 'joshua-chat';
  return createHash('sha256').update(`${String(value)}:${salt}`).digest('hex').slice(0, 16);
}

export function shipConversationLog(payload) {
  const url = process.env.LOGS_INGEST_URL;
  if (!url) {
    return Promise.resolve();
  }

  const secret = process.env.LOGS_INGEST_SECRET || '';
  const headers = { 'Content-Type': 'application/json' };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) {
        console.error('ingest failed', response.status);
      }
    })
    .catch((error) => {
      console.error('ingest error', error?.message || error);
    });
}
