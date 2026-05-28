import { verifyToken } from './_auth.js';

export default async function handler(req, res) {
  // IP 허용 목록 검사
  const rawAllowedIps = process.env.ALLOWED_IPS || '';
  if (rawAllowedIps.trim() !== '*') {
    const allowedIps = rawAllowedIps.split(',').map(ip => ip.trim()).filter(Boolean);
    if (allowedIps.length > 0) {
      const forwarded = req.headers['x-forwarded-for'] || '';
      const rawIp     = forwarded.split(',')[0].trim() || req.socket?.remoteAddress || '';
      const clientIp  = rawIp.replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, '$1');
      if (!allowedIps.includes(clientIp)) {
        return res.status(403).json({ error: '접근이 허용되지 않은 IP입니다.' });
      }
    }
  }

  if (!verifyToken(req.headers['authorization'])) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: '서버 환경변수가 설정되지 않았습니다.' });
  }

  const { path, name } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path 파라미터가 필요합니다.' });
  }
  if (path.includes('/') || path.includes('..') || path.includes('\\')) {
    return res.status(400).json({ error: '잘못된 경로입니다.' });
  }

  // 다운로드 서명 URL 생성 (120초 유효)
  const signResp = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/share_file/${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: 120 })
    }
  );

  if (!signResp.ok) {
    return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  }

  const { signedURL } = await signResp.json();
  if (!signedURL) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });

  const displayName = name || path;
  // ?download=filename → Supabase가 Content-Disposition: attachment 헤더를 추가
  const url = `${supabaseUrl}${signedURL}&download=${encodeURIComponent(displayName)}`;

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ url });
}
