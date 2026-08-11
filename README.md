# 하루핏

100일 동안 노트북, 휴대폰, GitHub 등의 활동 데이터를 한 곳에 모아 확인하는 개인 라이프로그 대시보드입니다.

## 권장 폴더 위치 (Windows)

```text
C:\Users\user\Documents\100day
```

다운로드한 압축을 위 경로에 풀어서 사용하면 됩니다.

## 현재 구성

```text
100day/
├─ src/                  # React 프론트엔드
├─ server/
│  ├─ index.mjs          # Node API 서버
│  ├─ db.mjs             # SQLite 연결 + 테이블 생성
│  └─ data/
│     ├─ .gitkeep        # 빈 data 폴더를 Git에 유지
│     └─ 100days.db      # 로컬 실행 시 자동 생성 (Git에는 포함하지 않음)
├─ scripts/
│  └─ dev.mjs            # 프론트 + 백엔드 동시 실행
├─ package.json
└─ vite.config.ts
```

## 실행

Node.js 22.5 이상을 권장합니다. (`node:sqlite` 사용)

```bash
cd C:\Users\user\Documents\100day
pnpm install
pnpm run dev
```

실행 후:

- Web: http://localhost:5173
- API: http://localhost:4000
- API 상태 확인: http://localhost:4000/api/health

## Docker 실행

```bash
docker compose up --build
```

로컬 Docker 실행 주소:

- Web/API: http://localhost:4000
- Google callback: http://localhost:4000/api/auth/google/callback
- GitHub callback: http://localhost:4000/api/auth/github/callback

## 학교 서버 HTTPS 배포

서버에서는 `.env`의 도메인을 실제 HTTPS 주소로 맞춥니다.

```env
API_PORT=4000
WEB_ORIGIN=https://your-domain.example
API_ORIGIN=https://your-domain.example

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

OAuth 콘솔 callback URL도 같은 도메인으로 등록해야 합니다.

```text
Google: https://your-domain.example/api/auth/google/callback
GitHub: https://your-domain.example/api/auth/github/callback
```

서버에서 실행:

```bash
docker compose up -d --build
```

데이터는 Docker volume `harufit-data`에 저장됩니다.

## DB / 실제 기록 데이터

`pnpm run dev` 또는 `pnpm run dev:api`를 처음 실행하면 `server/data/100days.db`가 자동 생성됩니다. DB에는 목데이터를 넣지 않고, 기본 100일 챌린지와 공부 카테고리만 준비합니다.

앱에서 직접 기록하면 다음 데이터가 저장됩니다.

- 공부 기록과 사용자가 추가한 공부/오프라인 활동 카테고리
- 이후 수집기 연동으로 들어올 PC / Phone / Steps / Exercise / GitHub 지표

SQLite DB 파일(`server/data/*.db`)은 `.gitignore`에 포함되어 GitHub에 올라가지 않습니다.

DB를 초기화하고 실제 기록을 모두 비우려면:

```bash
pnpm run db:reset
```

또는 `server/data/100days.db`를 직접 삭제한 후 서버를 다시 실행해도 됩니다. 이 경우에도 목데이터는 생성되지 않습니다.

## API

```text
GET  /api/health
GET  /api/challenge
GET  /api/dashboard/today
GET  /api/dashboard/today?day=1
GET  /api/timeline
GET  /api/analytics?days=30
GET  /api/devices
GET  /api/study/categories
POST /api/study/categories
GET  /api/focus/sessions
GET  /api/focus/sessions?day=1
POST /api/focus/sessions
GET  /api/result
```

### Focus Session POST 예시

```json
{
  "category": "독서",
  "note": "노트북 없이 교재 읽기",
  "started_at": "2026-08-10T21:00:00+09:00",
  "ended_at": "2026-08-10T22:15:00+09:00",
  "duration_minutes": 75
}
```

## 이후 실제 디바이스 연결

현재 앱은 목데이터 없이 실제 저장된 기록만 표시합니다. 아직 자동 수집기가 없는 항목은 0 또는 빈 목록으로 표시되며, 이후 각각의 수집기가 같은 API/DB 모델로 데이터를 보내도록 연결합니다.

1. Windows Desktop Tracker → PC/app usage
2. Chrome Extension → website usage
3. Android Companion → UsageStats
4. Health Connect → steps/exercise/watch data
5. GitHub OAuth/API → commit/PR activity

### Windows PC 사용 시간 트래커

앱의 `기기` 화면에서 `트래커 설치`를 눌러 연결 코드를 만든 뒤 실행합니다.

```powershell
pnpm run tracker:windows -- -PairingToken 연결코드
```

이후에는 저장된 기기 토큰으로 계속 실행할 수 있습니다.

```powershell
pnpm run tracker:windows
```

트래커는 1분마다 현재 활성 창을 확인하고, 3분 이상 입력이 없으면 유휴 상태로 보고 기록하지 않습니다.
