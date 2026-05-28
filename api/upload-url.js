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

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: '서버 설정 오류' });

  const resp = await fetch(
    `${supabaseUrl}/storage/v1/object/upload/sign/share_file/${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ upsert: false })
    }
  );

  if (!resp.ok) {
    const detail = await resp.text();
    return res.status(500).json({ error: '서명 URL 생성 실패', detail });
  }

  const data = await resp.json();

  // Supabase는 { token: "..." } 또는 { url: "/storage/v1/...?token=..." } 형태로 반환
  let token = data.token;
  if (!token && data.url) {
    const m = String(data.url).match(/[?&]token=([^&]+)/);
    token = m?.[1] ?? null;
  }
  if (!token) {
    return res.status(500).json({ error: '서명 토큰 획득 실패', response: data });
  }

  // 브라우저가 PUT 요청을 보낼 업로드 URL
  const uploadUrl =
    `${supabaseUrl}/storage/v1/object/upload/sign/share_file/${encodeURIComponent(path)}?token=${token}`;

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ uploadUrl });
}
