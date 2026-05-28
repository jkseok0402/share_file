# share_file

Vercel에 배포 가능한 단일 페이지 파일 공유 앱입니다.

## Vercel 환경변수

프로젝트 Settings > Environment Variables에 아래 값을 추가하세요.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

프론트는 `/api/config`를 통해 런타임에 환경변수를 읽습니다.

## 로컬 테스트

로컬에서도 동일하게 `api/config.js`를 사용해야 하므로 정적 파일 실행이 아니라 Vercel 로컬 서버로 실행하세요.

1. `.env.local` 생성
   - 이미 생성됨: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - 샘플 파일: `.env.local.example`
2. Vercel CLI 실행
   - `npx vercel dev`
3. 브라우저 접속
   - `http://localhost:3000`

## 배포

1. GitHub 저장소 연결
2. Vercel에서 Import
3. 환경변수 입력 후 Deploy
