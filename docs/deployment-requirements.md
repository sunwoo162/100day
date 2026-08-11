# 하루핏 배포 요구사항

## 현재 상태

하루핏 애플리케이션 코드는 `100day` 저장소의 `develop` 브랜치에 배포 준비가 되어 있습니다.

- Node API 서버 + React 정적 파일을 하나의 프로세스에서 실행
- PM2로 서버 프로세스 실행 가능
- GitHub Actions에서 학교 서버 SSH 접속 가능
- OAuth secret과 서버 접속 secret은 GitHub Actions secrets로 주입 가능

## 배포가 막힌 이유

학교 서버에 앱 프로세스를 올리는 것 자체는 가능하지만, 아래 주소가 외부 라우터/프록시에서 아직 등록되어 있지 않습니다.

```text
https://harufit.https.gsmsv.site
```

현재 외부에서 접속하면 아래 응답이 나옵니다.

```text
Subdomain not registered
```

즉 문제는 앱 코드가 아니라, `harufit` 서브도메인이 학교 HTTPS 라우팅 시스템에 등록되지 않은 것입니다.

## 필요한 서버 구성

같은 인스턴스에서 두 웹을 분리해서 돌리는 구조가 필요합니다.

```text
playground.https.gsmsv.site -> playground PM2 프로세스
harufit.https.gsmsv.site    -> harufit PM2 프로세스
```

하루핏 프로세스는 내부에서 별도 포트로 실행합니다.

```text
harufit 내부 포트: 4010
```

외부 프록시는 아래처럼 연결되어야 합니다.

```text
harufit.https.gsmsv.site -> 127.0.0.1:4010
```

## 서버에 필요한 작업

1. 학교 HTTPS 라우터 또는 서브도메인 관리 시스템에 `harufit` 등록

```text
harufit.https.gsmsv.site
```

2. 해당 서브도메인을 같은 서버 인스턴스로 연결

3. 서버 내부 Nginx 또는 프록시에서 하루핏 프로세스로 연결

```nginx
server {
    listen 80;
    server_name harufit.https.gsmsv.site;

    location / {
        proxy_pass http://127.0.0.1:4010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

4. PM2에서 하루핏 실행

```bash
cd /home/ubuntu/harufit
npm ci --no-audit --fund=false
npm run build
env $(grep -v '^#' .env | xargs) pm2 start server/index.mjs --name harufit
pm2 save
```

## 필요한 환경변수

서버의 `/home/ubuntu/harufit/.env` 또는 GitHub Actions secrets 기반으로 아래 값이 필요합니다.

```env
API_PORT=4010
WEB_ORIGIN=https://harufit.https.gsmsv.site
API_ORIGIN=https://harufit.https.gsmsv.site

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## GitHub Actions Secrets

`sunwoo162/100day` 저장소에 아래 repository secrets가 필요합니다.

```text
SSH_PASSWORD
HARUFIT_GOOGLE_CLIENT_ID
HARUFIT_GOOGLE_CLIENT_SECRET
HARUFIT_GITHUB_CLIENT_ID
HARUFIT_GITHUB_CLIENT_SECRET
```

## OAuth Callback URL

배포용 OAuth 앱에는 아래 callback URL을 등록해야 합니다.

```text
Google: https://harufit.https.gsmsv.site/api/auth/google/callback
GitHub: https://harufit.https.gsmsv.site/api/auth/github/callback
```

로컬 개발용 OAuth 앱은 별도로 두는 것이 좋습니다.

```text
Google local: http://localhost:4000/api/auth/google/callback
GitHub local: http://localhost:4000/api/auth/github/callback
```

## 주의사항

`playground.https.gsmsv.site/apps/harufit` 경로에 억지로 붙이는 방식은 사용하지 않습니다.

그 방식은 아래 문제가 생길 수 있습니다.

- OAuth callback 경로가 Playground와 섞임
- 쿠키 도메인/경로가 꼬일 수 있음
- API 경로가 Playground 라우팅과 충돌할 수 있음
- 하루핏을 독립 서비스처럼 관리하기 어려움

따라서 하루핏은 반드시 별도 서브도메인으로 배포합니다.

```text
https://harufit.https.gsmsv.site
```

