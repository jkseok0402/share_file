-- 허용 사용자 테이블
create table if not exists public.allowed_users (
  email text primary key
);

-- RLS 활성화
alter table public.allowed_users enable row level security;

-- 본인 이메일만 조회 가능 (클라이언트에서 허용 여부 확인용)
create policy "self select"
  on public.allowed_users
  for select
  to authenticated
  using (email = (auth.jwt() ->> 'email'));

-- INSERT / UPDATE / DELETE 는 대시보드에서만 (클라이언트 불가)

-- 허용할 이메일 추가 예시 (Supabase SQL Editor에서 직접 실행)
-- insert into public.allowed_users (email) values ('user@example.com');
