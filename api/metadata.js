import { verifyToken } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!verifyToken(req.headers['authorization'])) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  const { path, original_name } = req.body ?? {};
  if (!path || !original_name) {
    return res.status(400).json({ error: 'path, original_name이 필요합니다.' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: '서버 설정 오류' });

  const resp = await fetch(`${url}/rest/v1/file_metadata`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ path, original_name })
  });

  if (!resp.ok) return res.status(500).json({ error: '메타데이터 저장 실패' });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
}
