export default function handler(req, res) {
  const allowedIps = (process.env.ALLOWED_IPS || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);

  const forwarded = req.headers['x-forwarded-for'] || '';
  const clientIp  = forwarded.split(',')[0].trim() || req.socket?.remoteAddress || '';

  const isAllowedIp = allowedIps.length > 0 && allowedIps.includes(clientIp);

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    uploadAllowed:   !isAllowedIp,
    downloadAllowed: allowedIps.length === 0 || isAllowedIp
  });
}
