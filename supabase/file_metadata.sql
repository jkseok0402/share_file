-- 파일 원본명 매핑 테이블
create table if not exists public.file_metadata (
  path          text primary key,
  original_name text not null
);

alter table public.file_metadata enable row level security;

-- 인증된 사용자 전체 조회 허용 (공유 목적)
create policy "authenticated select"
  on public.file_metadata for select
  to authenticated using (true);

-- 인증된 사용자 삽입 허용
create policy "authenticated insert"
  on public.file_metadata for insert
  to authenticated with check (true);

-- 인증된 사용자 삭제 허용 (파일 삭제 시 정리용)
create policy "authenticated delete"
  on public.file_metadata for delete
  to authenticated using (true);

-- 파일 삭제 후 고아 행 정리 (cron.sql 의 삭제 스케줄과 함께 실행)
-- delete from public.file_metadata
-- where path not in (
--   select name from storage.objects where bucket_id = 'share_file'
-- );
