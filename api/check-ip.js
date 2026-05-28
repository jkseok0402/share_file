export default function handler(req, res) {
  const rawAllowedIps = process.env.ALLOWED_IPS || '';

  // * 이면 IP 제한 없이 업로드/다운로드 모두 허용
  if (rawAllowedIps.trim() === '*') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ uploadAllowed: true, downloadAllowed: true });
  }

  const allowedIps = rawAllowedIps.split(',').map(ip => ip.trim()).filter(Boolean);
  const forwarded  = req.headers['x-forwarded-for'] || '';
  const rawIp      = forwarded.split(',')[0].trim() || req.socket?.remoteAddress || '';
  const clientIp   = normalizeIp(rawIp);

  const isAllowedIp = allowedIps.length > 0 && allowedIps.includes(clientIp);

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    uploadAllowed:   !isAllowedIp,
    downloadAllowed: allowedIps.length === 0 || isAllowedIp,
    detectedIp:      clientIp,   // 실제 감지된 IP (ALLOWED_IPS 값과 비교용)
  });
}

// IPv4-mapped IPv6 정규화: ::ffff:1.2.3.4 → 1.2.3.4
function normalizeIp(ip) {
  return ip.replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, '$1');
}
