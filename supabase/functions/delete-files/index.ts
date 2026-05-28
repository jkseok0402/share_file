import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'share_file'
const CRON_SECRET_FALLBACK = 'sf_20260528_6a8f5f41f8c8447e9e3d3b7d'

Deno.serve(async (req: Request) => {
  // cron 호출 인증
  const authHeader = req.headers.get('Authorization')
  const cronSecret = Deno.env.get('CRON_SECRET') ?? CRON_SECRET_FALLBACK

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 버킷 내 전체 파일 목록 조회
  const { data: files, error: listError } = await sb.storage
    .from(BUCKET)
    .list('', { limit: 1000 })

  if (listError) {
    console.error('list error:', listError.message)
    return new Response(JSON.stringify({ error: listError.message }), { status: 500 })
  }

  const deletable = (files ?? []).filter(
    f => f.name !== '.emptyFolderPlaceholder'
  )

  if (deletable.length === 0) {
    console.log('No files to delete.')
    return new Response(JSON.stringify({ deleted: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const paths = deletable.map(f => f.name)
  const { error: deleteError } = await sb.storage.from(BUCKET).remove(paths)

  if (deleteError) {
    console.error('delete error:', deleteError.message)
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })
  }

  console.log(`Deleted ${paths.length} file(s):`, paths)
  return new Response(JSON.stringify({ deleted: paths.length, files: paths }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
