-- 1. pg_net 익스텐션 활성화 (Supabase 대시보드 Database > Extensions 에서도 가능)
create extension if not exists pg_net with schema extensions;

-- 2. pg_cron 익스텐션 활성화
create extension if not exists pg_cron with schema extensions;

-- 3. 1분마다 share_file 버킷에서
--    "업로드 후 10분 지난 파일"만 삭제
select cron.schedule(
  'delete-share-file-older-than-10min',
  '* * * * *',
  $$
  delete from storage.objects
  where bucket_id = 'share_file'
    and created_at <= now() - interval '10 minutes'
  $$
);

-- 스케줄 확인
-- select * from cron.job;

-- 스케줄 삭제 (필요 시)
-- select cron.unschedule('delete-share-file-older-than-10min');
