import { verifyToken } from './_auth.js';

export default async function handler(req, res) {
  if (!verifyToken(req.headers['authorization'])) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: '서버 설정 오류' });

  const h = { Authorization: `Bearer ${key}`, apikey: key };

  const [fr, mr] = await Promise.all([
    fetch(`${url}/storage/v1/object/list/share_file`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
    }),
    fetch(`${url}/rest/v1/file_metadata?select=path,original_name`, { headers: h })
  ]);

  const [files, metadata] = await Promise.all([fr.json(), mr.json()]);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    files:    Array.isArray(files)    ? files    : [],
    metadata: Array.isArray(metadata) ? metadata : []
  });
}
