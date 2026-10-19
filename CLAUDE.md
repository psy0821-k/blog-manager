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
- `SERVER_API_PROXY_TARGET`: 개발 서버가 `/server-api`를 중계할 자체 서버(`server/`) 주소. 서버 전용이며 `VITE_` 접두사가 없다. 중계할 때 `/server-api` 접두사를 떼고 보낸다.
- `VITE_SERVER_API_URL`: 배포용 자체 서버 주소. **개발 중에는 비워 둔다.** 비어 있으면 `SERVER_API_URL`(`src/lib/env.ts`)이 `/server-api` 프록시 경로가 되고, 값이 있으면 브라우저가 서버를 직접 호출하므로 서버의 `ADMIN_APP_ORIGIN`(CORS)에 관리 앱 오리진이 등록돼 있어야 한다.
- `VITE_BLOG_LOGIN_URL`: 블로그 `/admin-login` 주소. 끝 슬래시는 없어야 한다(`src/lib/env.ts`의 `trimTrailingSlash`가 제거한다). 값은 문서에 쓰지 않는다.
- `.env`는 열거나 수정하지 않는다(사용자가 허용한 경우만). 값 확인이 필요하면 키 이름과 형식만 점검한다.

## 아키텍처

블로그(Next.js, `playground`)를 관리하는 개인용 관리자 앱이다. 블로그 글은 블로그 API를 직접 호출하고, 할 일·사이트 모음·글감 아이디어는 자체 백엔드(`server/`)를 쓴다. 지금 구현된 서버 API는 글감 저장(`POST /ideas`)뿐이고, 나머지 도메인 API는 계획 단계다. 전체 설계는 `docs/plan.md`를 본다.

### 데이터 조회 경로

모든 조회는 한 가지 패턴을 따른다.

```
feature의 *-api.ts  →  use-*.ts 훅(useFetch + useCallback)  →  페이지/컴포넌트
        ↓
src/lib/api-client.ts의 apiGet  →  fetch
```

자체 서버로 보내는 쓰기는 `apiPost(path, body, { baseUrl: SERVER_API_URL })`로 같은 요청 코어를 탄다(`baseUrl`을 생략하면 블로그 API). 글감 저장은 `features/ideas/ideas-api.ts`의 `createIdea`와 `use-save-idea.ts`의 `useSaveIdea`(처리 중 상태, 중복 요청 차단)를 쓴다.

- `apiGet`·`apiPatch`·`apiDelete`(`src/lib/api-client.ts`)는 하나의 내부 요청 함수(`request`)를 공유한다. 쿼리를 만들고, 세션 토큰이 있으면 `Authorization: Bearer`를 붙이며, 실패하면 `ApiError(status)`를 던지고, 204처럼 본문이 없는 응답은 `undefined`로 돌려준다. 401/403이면 저장된 토큰을 지우고 재로그인한다(아래 "인증과 로그인 흐름"). 쓰기(PATCH·DELETE)도 읽기와 같은 인증·재로그인 규칙을 탄다.
- 토큰은 `sessionStorage`에 JWT로 저장한다(`src/lib/auth-token.ts`). 만료 30초 전부터 만료로 취급한다. 토큰은 블로그 로그인 후 `/auth/callback`이 저장한다(아래 "인증과 로그인 흐름").
- `useFetch(fetcher)`(`src/lib/use-fetch.ts`)는 `loading | success | error` 상태와 `reload`를 준다. **fetcher의 참조가 바뀌면 다시 요청하므로 호출부에서 `useCallback`으로 감싸야 한다.**
- 같은 훅 형태를 `src/features/posts/use-post-list.ts`, `categories/use-categories.ts`, `dashboard/hooks/use-weekly-post-counts.ts`가 쓴다.

### 블로그 API 특성

- 글 목록은 종류별 엔드포인트로 나뉜다: 프로젝트, 랩, 개발일지(`posts-api.ts`의 `POST_LIST_PATHS`). 응답은 `{ data, meta }`.
- `draft=true`가 없으면 **발행된 글만** 돌려준다. `draft=true`는 관리자 토큰이 필요하다.
- `pageSize` 상한은 50이고 기본 정렬은 `createdAt` 내림차순이다(개발일지는 `devNumber` 내림차순). 발행일 필드가 없어 `createdAt`을 발행 시점으로 쓴다.
- 글 단건 쓰기는 종류별 `/api/<projects|lab|devlog>/<slug>`다. `PATCH`는 본문 `{ published: boolean }`으로 발행 ↔ 임시저장을 바꾸고, `DELETE`는 성공하면 204(본문 없음)를 준다. 없거나 종류가 다른 글은 404다. 모두 관리자 토큰이 필요하다. 랩의 쓰기 API가 쿠키 세션만 받던 것을 토큰도 받게 하는 블로그 변경이 배포돼야 랩 글을 전환·삭제할 수 있다.
- 블로그 slug는 글자·숫자·하이픈만 허용한다. 경로에 넣을 때는 `encodeURIComponent`를 쓴다.
- 개발일지 번호(`devNumber`)는 처음 발행할 때 붙고, 임시저장으로 되돌렸다 다시 발행해도 유지된다.

### 라우팅과 화면

`src/routes.tsx`의 `createBrowserRouter`에서 `AppLayout`(사이드바 + `Outlet`) 아래에 페이지가 놓인다. 구현된 화면은 대시보드(`/`)와 컨텐츠 관리(`/manage`)뿐이고, `/todo`, `/reference`, `/ideas`는 `ComingSoonPage`다.

### 컨텐츠 관리 (`/manage`)

- 종류 탭(프로젝트·랩·개발일지)과 `발행됨 | 임시저장` 보기 전환이 있다. URL이 단일 출처이고 `?draft=true`가 임시저장 보기다. 보기·종류 탭·검색·카테고리를 바꾸면 페이지는 1쪽으로 돌아간다.
- 행 버튼: `편집`(블로그 편집 화면을 새 탭으로 연다), 전환(`임시저장으로 전환`/`발행`, `PATCH { published }`), `삭제`(확인 대화상자 `confirm-delete-dialog.tsx`를 거친다). 편집 링크 주소는 `post-edit-url.ts`가 `VITE_BLOG_LOGIN_URL`의 오리진 + `/projects|lab|devlog/<slug>/edit`로 만들고, 주소를 알 수 없으면 편집 열을 숨긴다(새 환경변수는 없다).
- 전환·삭제의 처리 상태는 `usePostActions`(`use-post-actions.ts`)가 글 id별로 관리한다. 같은 글이 처리 중이면 전환·삭제 모두 무시한다. 성공하면 목록을 다시 불러오고, 실패는 표 위에 오류 문구로 보인다(404는 "이미 삭제된 글입니다"). 낙관적 업데이트와 토스트는 쓰지 않는다.
- **삭제 대상은 대화상자를 연 시점의 `{ type, post }`로 저장한다**(`post-list-page.tsx`의 `deleteTarget`). 확정할 때 현재 URL의 종류를 다시 읽으면, 대화상자가 열린 채 브라우저 뒤로 가기로 종류가 바뀌었을 때 다른 종류의 글이 삭제될 수 있다. 그래서 확정은 항상 저장된 값으로 한다. 2쪽 이상의 마지막 글을 지우면 이전 페이지로 이동하되, 삭제 대상이 현재 목록에 있고 유일한 항목일 때만 한다.

### 인증과 로그인 흐름

- `/login`과 `/auth/callback`은 가드 밖 최상위 라우트이고, 나머지는 모두 `RequireAuth` 아래에 있다. `RequireAuth`는 토큰이 없으면 아무것도 그리지 않고 블로그 `/admin-login`(`VITE_BLOG_LOGIN_URL`)으로 보낸다.
- 가드 안의 catch-all(`*`)이 미등록 경로를 `NotFoundPage`로 처리한다. 그래서 미등록 경로도 토큰이 없으면 로그인으로 가고, 있으면 사이드바 안에 안내 화면이 나온다.
- `/auth/callback`은 URL 해시 `#token=`에서 토큰을 읽어 `sessionStorage`에 저장하고 복귀 경로로 이동한다.
- 복귀 경로는 로그인으로 보내기 전에 `sessionStorage`에 저장하며 앱 내부 경로만 허용한다.
- `apiGet`이 401/403을 받으면 토큰을 지우고 자동으로 재로그인한다. 재로그인 직후 짧은 시간 안에 다시 거부되면 이동하지 않고 오류만 남겨 루프를 끊는다.
- 로그아웃은 블로그 `/admin-logout`을 거쳐 `/login?loggedOut=1`로 돌아온다. 로그인 실패 이유와 잘못된 콜백은 `/login`이 안내한다.

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
- 응답을 흉내 낼 때 `fetchMock.mockResolvedValue(new Response(...))`는 `Response` 하나를 만들어 같은 호출에 계속 재사용한다. 본문은 한 번만 읽을 수 있어 두 번째 호출이 실패하니, 여러 번 호출되는 테스트는 `mockImplementation(async () => new Response(...))`로 호출마다 새로 만든다(204는 `new Response(null, { status: 204 })`).
- 사이드바를 렌더하는 테스트에는 `matchMedia` stub과 `TooltipProvider`(`App.tsx`가 감싸는 것과 같게)가 필요하다. Radix Dialog·Select·Tabs는 포털 렌더, `pointer-events`, `ResizeObserver` 등 jsdom 제약이 있어 필요한 stub을 테스트 파일 안에서 둔다.
- E2E(`e2e/`)는 가드 때문에 `e2e/helpers/auth.ts`의 `seedAuthToken`으로 토큰을 먼저 심고, 블로그 API는 `page.route`로 mock한다. `playwright.config.ts`가 `webServer.env`로 더미 `VITE_BLOG_LOGIN_URL`(로컬 더미 주소)을 넣는다. `reuseExistingServer: true`라서 5173에 개발 서버가 떠 있으면 그 서버를 재사용해 더미 주소가 적용되지 않으므로, **E2E를 돌리기 전에 개발 서버를 종료한다.**
- `page.route`는 나중에 등록한 것이 먼저 실행된다. 뒤에 등록한 route가 `fallback()` 없이 `fulfill`하면 앞 route의 요청 기록이 누락되니, 요청 수를 단언할 때는 응답하는 route 안에서 센다.

## 문서와 커밋

- `docs/features/`는 로컬 전용이다(`.git/info/exclude`로 제외). 기획 문서를 커밋하지 않는다.
- 운영 주소나 개인 경로가 들어간 값과 문서는 커밋하지 않는다. `docs/project-brief.md`에는 이미 운영 주소가 있으니 새 문서에 옮기지 않는다.
