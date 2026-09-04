import { createHash } from 'crypto';

const PRODUCTION_INGEST_URL = 'https://chat-observability.vercel.app/api/ingest';
const DEV_INGEST_SECRET = 'dev-ingest-secret';

export function hashOrigin(value) {
  const salt = process.env.LOG_SALT || 'joshua-chat';
  return createHash('sha256').update(`${String(value)}:${salt}`).digest('hex').slice(0, 16);
}

export function resolveIngestUrl() {
  const configured = (process.env.LOGS_INGEST_URL || '').trim();
  const onVercel = Boolean(process.env.VERCEL);
  if (onVercel && (!configured || /localhost|127\.0\.0\.1/.test(configured))) {
    return PRODUCTION_INGEST_URL;
  }
  return configured;
}

export function resolveIngestSecret() {
  const configured = (process.env.LOGS_INGEST_SECRET || process.env.INGEST_SECRET || '').trim();
  if (configured) return configured;
  if (process.env.VERCEL) return DEV_INGEST_SECRET;
  return '';
}

export function shipConversationLog(payload) {
  const url = resolveIngestUrl();
  if (!url) {
    console.warn('ingest skip: LOGS_INGEST_URL ausente');
    return Promise.resolve();
  }

  const secret = resolveIngestSecret();
  const headers = { 'Content-Type': 'application/json' };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  } else {
    console.warn('ingest warning: LOGS_INGEST_SECRET ausente');
  }

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
    .then(async (response) => {
      const text = await response.text();
      if (!response.ok) {
        console.error('ingest failed', response.status, text.slice(0, 300));
        return;
      }
      try {
        const body = JSON.parse(text);
        const loki = body?.data?.loki;
        if (loki && loki.status !== 'ok') {
          console.error('ingest loki', loki);
        } else {
          console.log('ingest ok', body?.data?.id, loki?.status || 'sem-loki');
        }
      } catch {
        /* ingest sem JSON não bloqueia o chat */
      }
    })
    .catch((error) => {
      console.error('ingest error', error?.message || error);
    });
}
