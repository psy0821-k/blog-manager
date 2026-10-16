# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 명령어

```bash
npm run dev        # Vite 개발 서버 (5173)
npm run build      # tsc -b && vite build (타입 검사 포함)
npm run lint       # oxlint
npm test           # vitest run (jsdom)
npx vitest run src/features/dashboard/__tests__/weekly-post-counts.test.ts   # 파일 하나
npx vitest run -t "테스트 이름 일부"                                          # 이름으로 하나
npm run test:e2e   # playwright test (e2e/ 폴더, 개발 서버를 자동으로 띄우거나 재사용)
```

## 환경변수

- `BLOG_API_PROXY_TARGET`: 개발 서버가 `/api`를 중계할 블로그 주소. 서버 전용이며 `VITE_` 접두사가 없다. **`.env`를 바꾼 뒤에는 개발 서버를 재시작해야 읽힌다.**
- `VITE_BLOG_API_URL`: 배포용 API 주소. **개발 중에는 비워 둔다.** 값이 있으면 프록시를 거치지 않고 브라우저가 직접 호출해 블로그 쪽 CORS에 막힌다.
- `.env`는 열거나 수정하지 않는다(사용자가 허용한 경우만). 값 확인이 필요하면 키 이름과 형식만 점검한다.

## 아키텍처

블로그(Next.js, `playground`)를 관리하는 개인용 관리자 앱이다. 블로그 글은 블로그 API를 직접 호출하고, 할 일·사이트 모음·글감 아이디어는 자체 백엔드(`server/`, 아직 없음)를 쓰는 계획이다. 전체 설계는 `docs/plan.md`를 본다.

### 데이터 조회 경로

모든 조회는 한 가지 패턴을 따른다.

```
feature의 *-api.ts  →  use-*.ts 훅(useFetch + useCallback)  →  페이지/컴포넌트
        ↓
src/lib/api-client.ts의 apiGet  →  fetch
```

- `apiGet`(`src/lib/api-client.ts`)은 GET만 지원한다. 쿼리를 만들고, 세션 토큰이 있으면 `Authorization: Bearer`를 붙이며, 실패하면 `ApiError(status)`를 던진다. 401/403이면 저장된 토큰을 지운다.
- 토큰은 `sessionStorage`에 JWT로 저장한다(`src/lib/auth-token.ts`). 만료 30초 전부터 만료로 취급한다. 개발 중에는 `/dev-token`(DEV 모드 전용 라우트)에 블로그가 발급한 토큰을 붙여 넣는다.
- `useFetch(fetcher)`(`src/lib/use-fetch.ts`)는 `loading | success | error` 상태와 `reload`를 준다. **fetcher의 참조가 바뀌면 다시 요청하므로 호출부에서 `useCallback`으로 감싸야 한다.**
- 같은 훅 형태를 `src/features/posts/use-post-list.ts`, `categories/use-categories.ts`, `dashboard/hooks/use-weekly-post-counts.ts`가 쓴다.

### 블로그 API 특성

- 글 목록은 종류별 엔드포인트로 나뉜다: 프로젝트, 랩, 개발일지(`posts-api.ts`의 `POST_LIST_PATHS`). 응답은 `{ data, meta }`.
- `draft=true`가 없으면 **발행된 글만** 돌려준다. `draft=true`는 관리자 토큰이 필요하다.
- `pageSize` 상한은 50이고 기본 정렬은 `createdAt` 내림차순이다(개발일지는 `devNumber` 내림차순). 발행일 필드가 없어 `createdAt`을 발행 시점으로 쓴다.

### 라우팅과 화면

`src/routes.tsx`의 `createBrowserRouter`에서 `AppLayout`(사이드바 + `Outlet`) 아래에 페이지가 놓인다. 구현된 화면은 대시보드(`/`)와 컨텐츠 관리(`/manage`)뿐이고, `/todo`, `/reference`, `/ideas`는 `ComingSoonPage`다.

### 대시보드는 대부분 가짜 데이터다

`src/features/dashboard/dashboard-mock.ts`의 mock으로 그린다. 예: "아이디어 생성" AI 대화는 `setTimeout` 뒤 고정 응답을 붙이는 가짜이고 실제 AI는 연결되지 않았다. **실데이터로 연결된 것은 "주차별 성실도", "최근 게시글", "임시 저장 게시물" 카드뿐이다.**

주차별 성실도의 흐름:
`api/weekly-consistency-api.ts`(프로젝트·랩 발행 글을 병렬 조회, 하나라도 실패하면 reject) → `hooks/use-weekly-post-counts.ts`(조회 후 집계) → `weekly-post-counts.ts`(순수 함수: 이번 달을 1일 기준 7일 단위 주차로 계산) → `weekly-consistency-section.tsx`가 상태에 따라 로딩/에러/카드 중 하나를 고른다. 개발일지와 임시저장은 집계하지 않는다.

최근 게시글의 흐름:
`api/recent-posts-api.ts`(프로젝트·랩·개발일지의 최신 1건씩을 병렬 조회, 종류 고정 순서, 글이 없는 종류는 빠짐, 하나라도 실패하면 reject) → `hooks/use-recent-posts.ts` → `recent-posts-section.tsx`가 `PostListCard`의 `status`(loading/error/success)로 상태를 표시한다. 임시저장은 포함하지 않는다.

임시 저장 게시물의 흐름:
`api/draft-posts-api.ts`(세 종류를 `draft: true`, `pageSize: 50`으로 병렬 조회해 합치고 `updatedAt` 오름차순 상위 3건만 남김, 하나라도 실패하면 reject) → `hooks/use-draft-posts.ts` → `draft-posts-section.tsx`가 `PostListCard`로 표시하고 우측에는 `elapsed-days.ts`의 `formatElapsedDays`('오늘', 'N일 전')를 쓴다. `draft=true`는 관리자 토큰이 필요해서 토큰이 없거나 거부되면(401/403) 일반 에러와 같은 화면이 나온다. 종류별 임시저장이 50건을 넘으면 가장 오래된 글이 빠질 수 있다.

## 컨벤션

- 경로 별칭 `@` → `src`. UI는 shadcn/ui(radix-nova) + Tailwind v4이고 컴포넌트는 `src/components/ui/`에 있다. 차트 라이브러리는 쓰지 않고 막대를 직접 그린다.
- TypeScript가 엄격하다(`noUnusedLocals`, `verbatimModuleSyntax`, `erasableSyntaxOnly`). 타입은 `import type`으로 가져오고 enum·namespace는 쓰지 않는다.
- 세미콜론은 폴더가 아니라 **파일마다 다르다**. 예: `lib/*`, `routes.tsx`, `posts-api.ts`는 없음, `dashboard/*`, `post-list-page.tsx`, `app-layout.tsx`는 있음. 수정하는 파일의 기존 스타일을 따르고 새 파일은 같은 폴더의 인접 파일을 따른다.
- lint는 `react/rules-of-hooks`(error)와 `only-export-components`(warn)만 설정되어 있다.

## 테스트

- Vitest(jsdom) + Testing Library. 설정은 `vite.config.ts`의 `test`, 공통 설정은 `src/test/setup.ts`(`globals`를 쓰지 않아 RTL 정리를 직접 호출한다).
- 테스트는 feature 안의 `__tests__/` 폴더에 모은다. 대시보드는 조회 코드도 `api/` 폴더로 분리했다.
- HTTP 경계인 `fetchPostList`만 `vi.mock`으로 대체하고 훅·집계·화면은 실제로 연결하는 통합 테스트를 쓴다(`weekly-consistency.integration.test.tsx`).
- 날짜에 의존하는 테스트는 `vi.useFakeTimers({ toFake: ['Date'] })`로 `Date`만 고정한다. 전체 타이머를 대체하면 Promise와 `userEvent`가 멈춘다.
- 막대 높이는 `data-testid="week-bar-{주차}"`의 `style.height`(%)로 검증한다.

## 문서와 커밋

- `docs/features/`는 로컬 전용이다(`.git/info/exclude`로 제외). 기획 문서를 커밋하지 않는다.
- 운영 주소나 개인 경로가 들어간 값과 문서는 커밋하지 않는다. `docs/project-brief.md`에는 이미 운영 주소가 있으니 새 문서에 옮기지 않는다.
