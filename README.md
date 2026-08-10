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
npm install
npm run dev
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

배포 환경에서는 `WEB_ORIGIN`, `API_ORIGIN`을 실제 HTTPS 도메인으로 설정하고, OAuth 콘솔에도 같은 callback URL을 등록합니다.

## DB / 실제 기록 데이터

`npm run dev` 또는 `npm run dev:api`를 처음 실행하면 `server/data/100days.db`가 자동 생성됩니다. DB에는 목데이터를 넣지 않고, 기본 100일 챌린지와 공부 카테고리만 준비합니다.

앱에서 직접 기록하면 다음 데이터가 저장됩니다.

- 공부 기록과 사용자가 추가한 공부/오프라인 활동 카테고리
- Daily check-in
- 이후 수집기 연동으로 들어올 PC / Phone / Sleep / Steps / Exercise / GitHub 지표

SQLite DB 파일(`server/data/*.db`)은 `.gitignore`에 포함되어 GitHub에 올라가지 않습니다.

DB를 초기화하고 실제 기록을 모두 비우려면:

```bash
npm run db:reset
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
GET  /api/checkins
GET  /api/checkins?day=1
POST /api/checkins
GET  /api/result
```

### Daily Check-in POST 예시

```json
{
  "focus_score": 8,
  "satisfaction_score": 7,
  "note": "오늘 React 공부를 많이 했다."
}
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
4. Health Connect → steps/sleep/exercise/watch data
5. GitHub OAuth/API → commit/PR activity
