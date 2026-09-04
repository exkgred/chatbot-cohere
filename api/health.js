import { resolveIngestSecret, resolveIngestUrl } from '../lib/ship-log.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = resolveIngestUrl();
  let ingestHost = null;
  try {
    ingestHost = url ? new URL(url).host : null;
  } catch {
    ingestHost = 'invalid';
  }
  return res.status(200).json({
    status: 'ok',
    ingestUrl: Boolean(url),
    ingestHost,
    ingestSecret: Boolean(resolveIngestSecret()),
    vercel: Boolean(process.env.VERCEL),
  });
}
