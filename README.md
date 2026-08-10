# 100 DAYS

100일 동안 노트북, 휴대폰, 워치, GitHub 등의 활동 데이터를 한 곳에 모아 확인하는 개인 라이프로그 대시보드입니다.

## 권장 폴더 위치 (Windows)

```text
C:\Users\user\Documents\100-days-dashboard
```

다운로드한 압축을 위 경로에 풀어서 사용하면 됩니다.

## 현재 구성

```text
100-days-dashboard/
├─ src/                  # React 프론트엔드
├─ server/
│  ├─ index.mjs          # Node API 서버
│  ├─ db.mjs             # SQLite 연결 + 테이블 생성
│  ├─ seed.mjs           # 테스트용 mock data 생성
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
cd C:\Users\user\Documents\100-days-dashboard
npm install
npm run dev
```

실행 후:

- Web: http://localhost:5173
- API: http://localhost:4000
- API 상태 확인: http://localhost:4000/api/health

## 로그인 설정

사용자별 기록 저장을 위해 Google 또는 GitHub OAuth 로그인이 필요합니다.

`.env.example`을 참고해 환경변수를 설정합니다.

```bash
WEB_ORIGIN=http://localhost:5173
API_ORIGIN=http://localhost:4000

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

OAuth 앱의 callback URL은 아래처럼 등록합니다.

```text
GitHub: http://localhost:4000/api/auth/github/callback
Google: http://localhost:4000/api/auth/google/callback
```

## DB / Mock Data

`npm run dev` 또는 `npm run dev:api`를 처음 실행하면 `server/data/100days.db`가 자동 생성됩니다.

DB에는 테스트용으로 다음 데이터가 미리 들어갑니다.

- DAY 1 ~ DAY 100 daily metrics
- PC / Phone / Focus / Sleep / Steps / Exercise
- Development time / GitHub commits
- VS Code / YouTube / Chrome / Instagram / Discord 사용시간
- DAY 1 ~ DAY 37 timeline events
- Laptop / Android phone / Galaxy Watch / GitHub 연결 정보
- Focus sessions
- Daily check-in

SQLite DB 파일(`server/data/*.db`)은 `.gitignore`에 포함되어 GitHub에 올라가지 않습니다.

DB를 초기화하고 100일치 테스트 목데이터를 다시 만들려면:

```bash
npm run db:reset
```

또는 `server/data/100days.db`를 직접 삭제한 후 서버를 다시 실행해도 됩니다.

## API

```text
GET  /api/health
GET  /api/auth/me
GET  /api/auth/github
GET  /api/auth/github/callback
GET  /api/auth/google
GET  /api/auth/google/callback
POST /api/auth/logout
GET  /api/challenge
GET  /api/dashboard/today?day=37
GET  /api/timeline
GET  /api/analytics?days=30
GET  /api/devices
GET  /api/focus/sessions?day=37
POST /api/focus/sessions
GET  /api/checkins?day=37
POST /api/checkins
GET  /api/result
```

### Daily Check-in POST 예시

```json
{
  "day_number": 37,
  "focus_score": 8,
  "satisfaction_score": 7,
  "note": "오늘 React 공부를 많이 했다."
}
```

### Focus Session POST 예시

```json
{
  "day_number": 37,
  "category": "Development",
  "started_at": "2026-08-10T21:00:00+09:00",
  "ended_at": "2026-08-10T22:15:00+09:00",
  "duration_minutes": 75
}
```

## 이후 실제 디바이스 연결

현재 DB 값은 테스트용 mock data입니다. 이후 각각의 수집기가 같은 API/DB 모델로 데이터를 보내도록 교체합니다.

1. Windows Desktop Tracker → PC/app usage
2. Chrome Extension → website usage
3. Android Companion → UsageStats
4. Health Connect → steps/sleep/exercise/watch data
5. GitHub OAuth/API → commit/PR activity
