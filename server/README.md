# 관리용 백엔드 (server)

블로그 관리 앱의 자체 백엔드다. 할 일·사이트 모음·글감 아이디어를 저장할 관리용 DB(Neon Postgres)에 Prisma로 연결한다. 전체 설계는 `docs/plan.md`를 본다.

이 문서는 **Neon 프로젝트 만들기부터 `/health` 확인까지** 한 번에 따라 하는 순서를 다룬다. 연결 문자열 같은 실제 값은 문서와 커밋에 쓰지 않는다.

## 관리용 DB는 블로그 DB와 분리한다

관리용 DB는 블로그가 쓰는 DB와 **다른 Neon 프로젝트**(최소한 다른 database)로 만든다. 관리 앱의 데이터와 블로그 글 데이터가 섞이지 않게 하고, 한쪽의 마이그레이션이나 실수가 다른 쪽에 영향을 주지 않게 하려는 것이다. 블로그 DB의 연결 문자열은 이 서버에 넣지 않는다.

## 1. Neon 프로젝트 만들기

1. Neon 콘솔에서 새 프로젝트를 만든다. 이름은 블로그와 구분되게 짓는다(예: 관리 앱 전용).
2. 프로젝트의 연결 정보 화면에서 연결 문자열을 **두 가지** 복사한다.

| 용도 | 환경변수 | 호스트 |
|---|---|---|
| 앱 실행(풀링) | `DATABASE_URL` | 호스트에 `-pooler`가 붙은 쪽 |
| 마이그레이션(직접) | `DIRECT_URL` | `-pooler`가 없는 쪽 |

풀링 연결은 앱의 요청 처리에, 직접 연결은 Prisma 마이그레이션에 쓴다. 마이그레이션에 풀링 연결을 쓰면 실패하거나 잠금 문제가 생길 수 있어서 `prisma.config.ts`가 `DIRECT_URL`만 읽는다.

## 2. 환경변수 설정

`server/.env.example`을 복사해 `server/.env`를 만들고 값을 채운다. `.env`는 git에서 제외돼 있다.

```
DATABASE_URL=   # 풀링 연결 문자열
DIRECT_URL=     # 직접 연결 문자열
PORT=           # 비우면 8787
AUTH_SECRET=    # 블로그가 관리자 토큰을 서명할 때 쓰는 비밀값
ADMIN_APP_ORIGIN=  # 관리자 앱 오리진(CORS 허용). 비우면 허용 오리진 없음
```

- `ADMIN_APP_ORIGIN`은 브라우저에서 이 서버를 호출하는 관리자 앱의 오리진이다. 끝 슬래시 없이 정확히 일치해야 하고, 개발 값은 Vite 개발 서버 오리진(5173 포트)이다. 비워도 서버는 뜨지만 브라우저 호출은 CORS로 막힌다.
- 루트 `.env`(프런트용)와는 별개 파일이다. 서버 설정은 `server/.env`에만 둔다.
- 연결 문자열이 `sslmode=require`이면 `pg`가 경고를 낼 수 있다. 동작에는 문제가 없고, 경고를 없애려면 `sslmode=verify-full`로 명시한다.

## 3. 설치와 Prisma 클라이언트 생성

`server/` 폴더에서 실행한다.

```bash
npm install
npm run db:generate
```

`server/generated/`는 git에서 제외돼 있어서, **새 환경에서는 서버를 띄우기 전에 `npm run db:generate`를 먼저 실행해야 한다.** `prisma.config.ts`가 `DIRECT_URL`을 읽으므로 이 값이 `server/.env`에 있어야 한다.

## 4. 마이그레이션 상태 확인

```bash
npm run db:status
```

`DIRECT_URL`로 연결해 적용 상태를 보여 준다. 아직 도메인 모델이 없어서 적용할 마이그레이션은 없다. 모델이 추가되면 `npm run db:migrate`로 적용한다.

## 5. 서버 실행과 헬스체크

```bash
npm run dev
```

다른 터미널에서 확인한다.

```bash
curl http://localhost:8787/health
```

| 상태 | HTTP | 응답 |
|---|---|---|
| 연결됨 | 200 | `{"status":"ok","database":"connected"}` |
| `DATABASE_URL` 없음 | 503 | `{"status":"error","database":"unavailable","reason":"DATABASE_URL_MISSING"}` |
| 연결 실패 | 503 | `{"status":"error","database":"unavailable","reason":"DATABASE_UNREACHABLE"}` |

실패해도 서버는 종료되지 않는다. 응답과 로그에는 연결 문자열이나 원인 오류 메시지를 남기지 않고 reason 코드만 남긴다.

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| `Cannot resolve environment variable: DIRECT_URL` | `server/.env`에 `DIRECT_URL`이 있는지 확인한다. `db:generate`·`db:status`·`db:migrate`에 필요하다. |
| `/health`가 `DATABASE_URL_MISSING` | `server/.env`에 `DATABASE_URL`을 넣고 서버를 재시작한다(`.env`는 시작할 때만 읽는다). |
| `/health`가 `DATABASE_UNREACHABLE` | 풀링 연결 문자열이 맞는지, Neon 프로젝트가 켜져 있는지(유휴 후 첫 요청은 느릴 수 있다) 확인한다. |
| `generated/prisma/client`를 찾을 수 없다 | `npm run db:generate`를 실행한다. |

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 파일 변경을 감시하며 서버 실행 |
| `npm start` | 서버 실행 |
| `npm test` | 단위 테스트 (DB에 연결하지 않는다) |
| `npm run typecheck` | 타입 검사 |
| `npm run db:generate` | Prisma 클라이언트 생성 |
| `npm run db:migrate` | 마이그레이션 적용 (`DIRECT_URL`) |
| `npm run db:status` | 마이그레이션 상태 확인 (`DIRECT_URL`) |
