import { verifyToken } from './_auth.js';
import { Readable } from 'stream';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end();
  if (!verifyToken(req.headers['authorization'])) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  const { path, name } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path 파라미터가 필요합니다.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: '서버 설정 오류' });

  const contentType   = req.headers['content-type'] || 'application/octet-stream';
  const contentLength = req.headers['content-length'];

  const uploadHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': contentType,
    'x-upsert': 'false'
  };
  if (contentLength) uploadHeaders['Content-Length'] = contentLength;

  // IncomingMessage → Web ReadableStream 변환 후 Supabase로 스트리밍 전달
  // (전체 버퍼링 없이 브라우저에서 받는 즉시 Supabase로 전달)
  const upResp = await fetch(
    `${supabaseUrl}/storage/v1/object/share_file/${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: uploadHeaders,
      body: Readable.toWeb(req),
      duplex: 'half'
    }
  );

  if (!upResp.ok) {
    const detail = await upResp.text();
    return res.status(500).json({ error: '파일 저장 실패', detail });
  }

  // 원본 파일명 메타데이터 저장 (업로드 성공 후)
  if (name) {
    await fetch(`${supabaseUrl}/rest/v1/file_metadata`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ path, original_name: name })
    });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, path });
}
