export default async function handler(req, res) {
  // IP 허용 목록 검사
  const allowedIps = (process.env.ALLOWED_IPS || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);

  if (allowedIps.length > 0) {
    const forwarded = req.headers['x-forwarded-for'] || '';
    const clientIp  = forwarded.split(',')[0].trim() || req.socket?.remoteAddress || '';
    if (!allowedIps.includes(clientIp)) {
      return res.status(403).json({ error: '접근이 허용되지 않은 IP입니다.' });
    }
  }

  // JWT 검증
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: '서버 환경변수가 설정되지 않았습니다.' });
  }

  // 사용자 JWT 유효성 확인
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY || '' }
  });
  if (!userResp.ok) {
    return res.status(401).json({ error: '유효하지 않은 인증 토큰입니다.' });
  }

  const { path, name } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path 파라미터가 필요합니다.' });
  }

  // 경로 traversal 방지
  if (path.includes('/') || path.includes('..') || path.includes('\\')) {
    return res.status(400).json({ error: '잘못된 경로입니다.' });
  }

  // Supabase Storage에서 파일 가져오기 (service role key 사용)
  const storageUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent('share_file')}/${encodeURIComponent(path)}`;
  const fileResp   = await fetch(storageUrl, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
  });

  if (!fileResp.ok) {
    return res.status(fileResp.status).json({ error: '파일을 찾을 수 없습니다.' });
  }

  const contentType = fileResp.headers.get('content-type') || 'application/octet-stream';
  const displayName = name || path;
  const encoded     = encodeURIComponent(displayName);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
  res.setHeader('Cache-Control', 'no-store');

  const buffer = await fileResp.arrayBuffer();
  res.send(Buffer.from(buffer));
}
