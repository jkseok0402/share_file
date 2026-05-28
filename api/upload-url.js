import { verifyToken } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!verifyToken(req.headers['authorization'])) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  const { path } = req.body ?? {};
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path 파라미터가 필요합니다.' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: '서버 설정 오류' });

  const resp = await fetch(
    `${url}/storage/v1/object/upload/sign/share_file/${encodeURIComponent(path)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key } }
  );

  if (!resp.ok) {
    return res.status(500).json({ error: '서명 URL 생성 실패' });
  }

  const data = await resp.json();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ uploadUrl: `${url}${data.url}` });
}
