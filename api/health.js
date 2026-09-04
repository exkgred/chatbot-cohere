import { resolveIngestSecret, resolveIngestUrl } from '../lib/ship-log.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = resolveIngestUrl();
  return res.status(200).json({
    status: 'ok',
    ingestUrl: Boolean(url),
    ingestSecret: Boolean(resolveIngestSecret()),
    vercel: Boolean(process.env.VERCEL),
  });
}
