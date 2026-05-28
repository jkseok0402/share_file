-- share_file 버킷 파일 크기 제한 설정
-- Supabase 대시보드 SQL Editor에서 실행

-- 현재 버킷 설정 확인
select id, name, file_size_limit, allowed_mime_types
from storage.buckets
where name = 'share_file';

-- 파일 크기 제한 변경 (단위: bytes)
-- 50MB  = 52428800
-- 100MB = 104857600
-- 500MB = 524288000
update storage.buckets
set file_size_limit = 524288000  -- 500MB
where name = 'share_file';
