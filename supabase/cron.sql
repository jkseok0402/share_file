-- 1. pg_net 익스텐션 활성화 (Supabase 대시보드 Database > Extensions 에서도 가능)
create extension if not exists pg_net with schema extensions;

-- 2. pg_cron 익스텐션 활성화
create extension if not exists pg_cron with schema extensions;

-- 3. 10분마다 delete-files Edge Function 호출
--    CRON_SECRET 환경변수를 따로 설정하지 않았다면 아래 기본값을 사용합니다.
--    기본값: sf_20260528_6a8f5f41f8c8447e9e3d3b7d
select cron.schedule(
  'delete-files-every-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://vixxkcxympkvaorvsjtx.supabase.co/functions/v1/delete-files',
    headers := jsonb_build_object('Authorization', 'Bearer sf_20260528_6a8f5f41f8c8447e9e3d3b7d')
  )
  $$
);

-- 스케줄 확인
-- select * from cron.job;

-- 스케줄 삭제 (필요 시)
-- select cron.unschedule('delete-files-every-10min');
