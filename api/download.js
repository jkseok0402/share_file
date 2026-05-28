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

  const h = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };

  // Supabase에서 파일 가져오기
  const fileResp = await fetch(
    `${supabaseUrl}/storage/v1/object/share_file/${encodeURIComponent(path)}`,
    { headers: h }
  );

  if (!fileResp.ok) {
    // 404면 이미 다운로드되어 삭제된 것
    const status = fileResp.status === 404 ? 404 : 500;
    return res.status(status).json({
      error: status === 404
        ? '파일이 이미 다운로드되었거나 삭제되었습니다.'
        : '파일을 가져오는 중 오류가 발생했습니다.'
    });
  }

  const contentType = fileResp.headers.get('content-type') || 'application/octet-stream';
  const displayName = name || path;
  const encoded     = encodeURIComponent(displayName);

  // 파일 내용을 버퍼로 수신
  const buffer = Buffer.from(await fileResp.arrayBuffer());

  // 수신 즉시 Storage + 메타데이터 삭제 (브라우저 전송 전에 완료)
  await Promise.all([
    fetch(`${supabaseUrl}/storage/v1/object/share_file`, {
      method: 'DELETE',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [path] })
    }),
    fetch(`${supabaseUrl}/rest/v1/file_metadata?path=eq.${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers: h
    })
  ]);

  // 삭제 완료 후 브라우저에 파일 전송
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
  res.setHeader('Content-Length', buffer.length.toString());
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}
