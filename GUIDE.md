# Share File 웹 파일 서버 구현 지침서

## 프로젝트 개요

- **목적**: 구글 인증 기반 임시 파일 공유 웹 서버
- **스토리지**: Supabase Storage (`share_file` 버킷)
- **인증**: Google OAuth (Supabase Auth)
- **자동 삭제**: 10분 주기로 전체 파일 삭제
- **UI**: 최소한의 단일 HTML 페이지

---

## 기술 스택

| 역할 | 기술 |
|------|------|
| 프론트엔드 | Vanilla HTML / CSS / JS (단일 파일) |
| 인증 | Supabase Auth + Google OAuth 2.0 |
| 파일 저장 | Supabase Storage |
| 자동 삭제 | Supabase Edge Function + Cron |
| 호스팅 | Vercel / Netlify / GitHub Pages (정적) |

---

## 1단계: Supabase 프로젝트 설정

### 1-1. 프로젝트 생성
1. [supabase.com](https://supabase.com) 접속 후 새 프로젝트 생성
2. 프로젝트 이름, 비밀번호, 리전 설정
3. 생성 완료 후 **Project URL**과 **anon public key** 복사해 두기
   - `Settings > API` 메뉴에서 확인

### 1-2. Storage 버킷 생성
1. Supabase 대시보드 → `Storage` 메뉴
2. `New bucket` 클릭
3. 버킷 이름: `share_file`
4. **Public bucket**: OFF (인증된 사용자만 접근)
5. 생성 완료

### 1-3. Storage RLS 정책 설정
`Storage > Policies`에서 `share_file` 버킷에 아래 정책 추가:

```sql
-- 인증된 사용자만 업로드 허용
CREATE POLICY "authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'share_file');

-- 인증된 사용자만 다운로드/목록 조회 허용
CREATE POLICY "authenticated select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'share_file');

-- 인증된 사용자만 삭제 허용 (Edge Function용)
CREATE POLICY "authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'share_file');
```

---

## 2단계: Google OAuth 설정

### 2-1. Google Cloud Console 설정
1. [console.cloud.google.com](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
3. `API 및 서비스 > 사용자 인증 정보` 이동
4. `사용자 인증 정보 만들기 > OAuth 클라이언트 ID` 선택
5. 애플리케이션 유형: **웹 애플리케이션**
6. 승인된 리디렉션 URI 추가:
   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```
7. **클라이언트 ID**와 **클라이언트 보안 비밀** 복사

### 2-2. Supabase에 Google OAuth 등록
1. Supabase 대시보드 → `Authentication > Providers`
2. **Google** 활성화
3. Google Console에서 복사한 Client ID, Client Secret 입력
4. 저장

### 2-3. Redirect URL 설정
`Authentication > URL Configuration`에서:
- **Site URL**: 배포할 도메인 (예: `https://your-app.vercel.app`)
- **Redirect URLs**: 동일한 도메인 추가

---

## 3단계: 프론트엔드 구현

아래 파일 하나로 전체 웹 앱을 구성합니다.

### 파일 구조
```
share-file/
├── index.html      ← 단일 페이지 앱
└── GUIDE.md
```

### index.html 전체 코드

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Share File</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { background: white; border-radius: 12px; padding: 32px; width: 480px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 24px; color: #111; }
    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px; border-radius: 8px; border: none;
      font-size: 14px; cursor: pointer; font-weight: 500; transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-google { background: #4285F4; color: white; width: 100%; justify-content: center; }
    .btn-logout { background: #f0f0f0; color: #333; font-size: 13px; padding: 6px 14px; }
    .btn-upload { background: #111; color: white; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .user-info { font-size: 13px; color: #666; }
    .file-list { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
    .file-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; background: #f9f9f9; border-radius: 8px;
      font-size: 14px;
    }
    .file-name { color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; }
    .file-size { color: #999; font-size: 12px; margin-left: 8px; }
    .btn-download { background: none; border: 1px solid #ddd; color: #333; padding: 4px 12px; font-size: 12px; border-radius: 6px; cursor: pointer; }
    .btn-download:hover { background: #f0f0f0; }
    .upload-area {
      border: 2px dashed #ddd; border-radius: 8px; padding: 24px;
      text-align: center; color: #999; font-size: 14px; margin-bottom: 16px;
      cursor: pointer; transition: border-color 0.15s;
    }
    .upload-area:hover, .upload-area.drag-over { border-color: #4285F4; color: #4285F4; }
    .empty { text-align: center; color: #bbb; font-size: 14px; padding: 24px 0; }
    .timer { font-size: 12px; color: #f59e0b; background: #fffbeb; padding: 6px 12px; border-radius: 6px; margin-bottom: 16px; }
  </style>
</head>
<body>
<div class="container" id="app">
  <div id="login-view">
    <h1>Share File</h1>
    <p style="font-size:14px;color:#666;margin-bottom:24px;">파일을 안전하게 공유하세요. 10분마다 자동 삭제됩니다.</p>
    <button class="btn btn-google" id="login-btn">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFF" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.8 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>
      Google로 로그인
    </button>
  </div>

  <div id="main-view" style="display:none;">
    <div class="header">
      <h1>Share File</h1>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="user-info" id="user-email"></span>
        <button class="btn btn-logout" id="logout-btn">로그아웃</button>
      </div>
    </div>
    <div class="timer" id="timer-display">다음 삭제까지: --:--</div>
    <div class="upload-area" id="drop-zone">
      파일을 여기에 끌어다 놓거나 클릭해서 업로드
      <input type="file" id="file-input" style="display:none" multiple>
    </div>
    <div class="file-list" id="file-list"></div>
  </div>
</div>

<script>
  const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
  const BUCKET = 'share_file';

  const { createClient } = supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const loginView = document.getElementById('login-view');
  const mainView = document.getElementById('main-view');
  const userEmailEl = document.getElementById('user-email');
  const fileListEl = document.getElementById('file-list');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const timerEl = document.getElementById('timer-display');

  // 인증 상태 감지
  sb.auth.onAuthStateChange((event, session) => {
    if (session) {
      showMain(session.user);
    } else {
      showLogin();
    }
  });

  document.getElementById('login-btn').addEventListener('click', async () => {
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
  });

  function showLogin() {
    loginView.style.display = 'block';
    mainView.style.display = 'none';
  }

  function showMain(user) {
    loginView.style.display = 'none';
    mainView.style.display = 'block';
    userEmailEl.textContent = user.email;
    loadFiles();
    startTimer();
  }

  // 파일 목록 불러오기
  async function loadFiles() {
    const { data, error } = await sb.storage.from(BUCKET).list('', { sortBy: { column: 'created_at', order: 'desc' } });
    fileListEl.innerHTML = '';
    if (error || !data || data.length === 0) {
      fileListEl.innerHTML = '<div class="empty">업로드된 파일이 없습니다</div>';
      return;
    }
    data.forEach(file => {
      const item = document.createElement('div');
      item.className = 'file-item';
      const size = file.metadata?.size ? formatSize(file.metadata.size) : '';
      item.innerHTML = `
        <span class="file-name" title="${file.name}">${file.name}<span class="file-size">${size}</span></span>
        <button class="btn-download" data-name="${file.name}">다운로드</button>
      `;
      item.querySelector('.btn-download').addEventListener('click', () => downloadFile(file.name));
      fileListEl.appendChild(item);
    });
  }

  // 파일 다운로드
  async function downloadFile(name) {
    const { data, error } = await sb.storage.from(BUCKET).download(name);
    if (error) { alert('다운로드 실패: ' + error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 파일 업로드 (드래그 앤 드롭 + 클릭)
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => uploadFiles(e.target.files));

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    uploadFiles(e.dataTransfer.files);
  });

  async function uploadFiles(files) {
    for (const file of files) {
      const path = `${Date.now()}_${file.name}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, file);
      if (error) alert(`업로드 실패 (${file.name}): ` + error.message);
    }
    loadFiles();
  }

  // 10분 삭제 타이머 표시 (Edge Function 기준 00:00, 00:10 등)
  function startTimer() {
    function update() {
      const now = new Date();
      const seconds = now.getSeconds() + now.getMinutes() % 10 * 60;
      const remaining = 600 - seconds;
      const m = String(Math.floor(remaining / 60)).padStart(2, '0');
      const s = String(remaining % 60).padStart(2, '0');
      timerEl.textContent = `다음 삭제까지: ${m}:${s}`;
    }
    update();
    setInterval(update, 1000);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }
</script>
</body>
</html>
```

---

## 4단계: 자동 삭제 Edge Function

### 4-1. Supabase CLI 설치 및 초기화

```bash
npm install -g supabase
supabase login
supabase init
supabase link --project-ref YOUR_PROJECT_REF
```

### 4-2. Edge Function 생성

```bash
supabase functions new delete-files
```

`supabase/functions/delete-files/index.ts` 파일 내용:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'share_file'

Deno.serve(async (req) => {
  // cron 요청 검증 (선택)
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: files, error: listError } = await sb.storage.from(BUCKET).list()
  if (listError) return new Response(listError.message, { status: 500 })

  if (!files || files.length === 0) {
    return new Response(JSON.stringify({ deleted: 0 }), { status: 200 })
  }

  const paths = files.map(f => f.name)
  const { error: deleteError } = await sb.storage.from(BUCKET).remove(paths)
  if (deleteError) return new Response(deleteError.message, { status: 500 })

  return new Response(JSON.stringify({ deleted: paths.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### 4-3. Edge Function 배포

```bash
# 환경변수 설정
supabase secrets set CRON_SECRET=your-random-secret-string

# 배포
supabase functions deploy delete-files
```

### 4-4. Cron 스케줄 등록 (10분 주기)

Supabase 대시보드 → `Database > Extensions`에서 `pg_cron` 활성화 후:

```sql
-- SQL Editor에서 실행
select cron.schedule(
  'delete-files-every-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/delete-files',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  )
  $$
);
```

> `pg_net` 익스텐션도 활성화 필요: `Database > Extensions > pg_net`

---

## 5단계: 환경변수 설정 및 배포

### 5-1. index.html 수정

```js
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';  // 실제 값으로 교체
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';                    // 실제 값으로 교체
```

### 5-2. Vercel 배포 (권장)

```bash
npm install -g vercel
vercel --prod
```

또는 GitHub 저장소 연결 후 Vercel 대시보드에서 자동 배포 설정.

### 5-3. Supabase Redirect URL 최종 확인

배포된 URL을 Supabase `Authentication > URL Configuration`에 추가:
```
https://your-app.vercel.app
```

---

## 체크리스트

- [ ] Supabase 프로젝트 생성 및 API 키 복사
- [ ] `share_file` 버킷 생성
- [ ] Storage RLS 정책 3개 추가
- [ ] Google Cloud Console OAuth 클라이언트 생성
- [ ] Supabase Google OAuth 연동
- [ ] `index.html`에 Supabase URL/Key 입력
- [ ] Edge Function `delete-files` 배포
- [ ] `pg_cron` + `pg_net` 익스텐션 활성화
- [ ] Cron 스케줄 등록 (10분 주기)
- [ ] 웹 앱 배포 및 Redirect URL 등록
- [ ] 구글 로그인 → 파일 업로드/다운로드 동작 확인
- [ ] 10분 후 자동 삭제 동작 확인

---

## 보안 참고사항

- `SUPABASE_ANON_KEY`는 RLS가 활성화된 상태에서는 공개해도 안전합니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 프론트엔드에 노출하지 마세요 (Edge Function에서만 사용).
- `CRON_SECRET`은 추측하기 어려운 무작위 문자열로 설정하세요.
- 필요 시 `Authentication > Settings`에서 허용 이메일 도메인을 제한할 수 있습니다.
