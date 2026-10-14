# 블로그 관리 앱 프로젝트 개요

## 목적
기존 블로그를 관리하는 별도 React 프로젝트.
- 글 관리: 목록, 작성, 수정, 삭제, 임시저장, 카테고리/태그 관리
- 조회수 관리: 글별 조회수 현황 (`Post.viewCount` 기준)

## 참조 프로젝트 (읽기 전용)
- 경로: `C:\Users\psy\project\playground`
- 운영 주소: `https://blog-project-mu-six.vercel.app` (Vercel + Neon PostgreSQL)
- 스택: Next.js 16(App Router), Prisma 7, Auth.js(구글 로그인), zod, ImageKit
- 규칙: 블로그 repo는 이 프로젝트에서 수정하지 않는다. 필요한 변경은 `blog-api-requests.md`에 정리한다.

## 확정된 설계 결정
| 이슈 | 결정 |
|---|---|
| 토큰 발급 | 블로그에서 구글 로그인 후 `관리앱/callback#token=...`으로 리디렉션해 전달 (쿠키 비의존) |
| 데이터 접근 | 블로그 API만 경유. 관리 앱은 DB에 직접 접속하지 않는다 |
| 조회수 범위 | `Post.viewCount`만. `SiteVisit` 통계는 별도 이슈로 미룬다 |
| 에디터 | 블로그와 동일하게 `react-quill-new`(HTML 저장)로 호환성 유지 |

## 인증 구조 (블로그 현재)
- 구글 로그인 + `ADMIN_EMAIL` 단일 운영자만 ADMIN.
- 관리 API는 세션 쿠키 또는 `Authorization: Bearer <JWT>` 허용 (`requireAdmin`).
- JWT: HS256, 서명 키는 블로그 `AUTH_SECRET`, 유효 1시간.
- CORS는 `ADMIN_APP_ORIGIN`과 정확히 같은 오리진만 허용, `Allow-Credentials` 없음.

## 코드 확인으로 알게 된 제약
- `GET /api/{projects,lab,devlog}/[slug]`는 발행된 글만 반환하고 호출마다 `viewCount`를 +1 한다.
- 목록 API 응답에는 `content`가 없다. 임시저장 글 본문을 가져올 관리자용 API가 없다.
- 목록 쿼리: `draft`, `category`(slug), `q`(제목 검색), 페이지네이션. 정렬은 최신 작성순 고정.
- `SiteVisit` 모델은 있으나 기록하는 코드가 없다.

## 개발 규칙
- 한국어 응답/주석/문서/커밋 메시지. 변수·함수 camelCase, 컴포넌트 PascalCase, 상수 UPPER_SNAKE_CASE, 파일명 kebab-case.
- TypeScript strict, `any` 금지. 불필요한 라이브러리 추가 금지. YAGNI, DRY, 단일 책임.
- 비밀 값(DB 주소, 키, 토큰, `.env`)은 대화·코드·커밋에 적지 않는다. 환경변수는 `.env.example`에 이름만 둔다.
- 커밋 메시지에 Co-Authored-By 줄을 붙이지 않는다.
