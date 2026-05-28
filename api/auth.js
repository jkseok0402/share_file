import { createToken } from './_auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const pin   = String(req.body?.pin ?? '');
  const valid = process.env.PIN_CODE ?? '';

  if (!valid) {
    return res.status(500).json({ error: '서버에 PIN이 설정되지 않았습니다.' });
  }

  if (!/^\d{4}$/.test(pin) || pin !== valid) {
    return res.status(401).json({ error: 'PIN이 올바르지 않습니다.' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ token: createToken() });
}
