# share_file

Vercel에 배포 가능한 단일 페이지 파일 공유 앱입니다.

## Vercel 환경변수

프로젝트 Settings > Environment Variables에 아래 값을 추가하세요.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

프론트는 `/api/config`를 통해 런타임에 환경변수를 읽습니다.

## 배포

1. GitHub 저장소 연결
2. Vercel에서 Import
3. 환경변수 입력 후 Deploy
