import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'share_file'
const DELETE_AFTER_MS = 1 * 60 * 1000

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('X-Cron-Secret') !== cronSecret) {
    return new Response('Forbidden', { status: 403 })
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 버킷 전체 파일 조회
  const { data: files, error: listError } = await sb.storage
    .from(BUCKET)
    .list('', { limit: 1000 })

  if (listError) {
    return new Response(JSON.stringify({ error: listError.message }), { status: 500 })
  }

  const now = Date.now()
  const deletable = (files ?? []).filter(f => {
    if (f.name === '.emptyFolderPlaceholder') return false
    if (!f.created_at) return false
    return now - new Date(f.created_at).getTime() >= DELETE_AFTER_MS
  })

  if (deletable.length === 0) {
    return new Response(JSON.stringify({ deleted: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const paths = deletable.map(f => f.name)

  // Storage API로 삭제
  const { error: deleteError } = await sb.storage.from(BUCKET).remove(paths)
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })
  }

  // file_metadata 고아 행 정리
  await sb.from('file_metadata').delete().in('path', paths)

  return new Response(JSON.stringify({ deleted: paths.length, files: paths }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
