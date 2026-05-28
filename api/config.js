export default function handler(_req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY'
    });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey
  });
}
