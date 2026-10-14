# 2단계 계획: 글 목록 화면

## 결정 사항 (인터뷰)
| 항목 | 결정 |
|---|---|
| 개발용 인증 | 토큰 직접 붙여넣기 화면 (`sessionStorage`, 개발 모드에서만 라우트 등록). 로그인 연동 시 제거 |
| 목록 범위 | 종류 탭(PROJECT/LAB/DEV_LOG), 제목 검색, 카테고리 필터, 페이지네이션. 발행/임시저장 전환은 제외 |
| 데이터 호출 | 직접 `fetch` + 커스텀 훅 (라이브러리 추가 없음) |
| 스타일 | CSS Modules |
| CORS (개발) | Vite `server.proxy`로 `/api`를 블로그에 중계. 클라이언트는 상대 경로 사용 |

## 환경변수 (이름만)
- `BLOG_API_PROXY_TARGET` — Vite 프록시 대상(서버 측 전용, 클라이언트에 노출되지 않음)
- `VITE_BLOG_API_URL` — 배포 시 API 주소. 비우면 상대 경로(`/api`) 사용

## API 확인 사항
- 응답: `{ data, meta: { page, pageSize, totalCount, totalPages } }`, 기본 pageSize 30 / 최대 50
- PROJECT·LAB 항목: `id, title, slug, thumbnailUrl, status, viewCount, createdAt, updatedAt`
- DEV_LOG 항목: `id, devNumber, title, slug, viewCount, createdAt, updatedAt` (상태 없음)
- 목록 응답에 카테고리 이름과 `published`가 없다 → 행에 카테고리 표시 불가, 필터만 가능
- `GET /api/categories?type=`는 공개, `{ id, type, name, slug, order }[]`

## 파일 구성
```
src/
├─ lib/ env.ts, auth-token.ts, api-client.ts
├─ features/
│  ├─ auth/dev-token-page.tsx
│  ├─ categories/ category-types.ts, categories-api.ts, use-categories.ts
│  └─ posts/ post-types.ts, posts-api.ts, use-post-list.ts,
│            post-list-page.tsx, post-list-page.module.css
├─ routes.tsx
└─ app.tsx (RouterProvider 연결)
```

## 동작 규칙
- 탭·검색어·카테고리·페이지는 URL 쿼리에 저장 (`?type=&q=&category=&page=`)
- 검색 300ms 디바운스, 조건 변경 시 page=1로 초기화, 탭 변경 시 카테고리 초기화
- 로딩 / 빈 목록 / 에러(재시도) 상태 표시, 요청은 AbortController로 취소
- 토큰이 있으면 Bearer 헤더로 전송, 401/403이면 토큰 삭제

## 검증
- `npm run build`, `npm run lint`
- 개발 서버 + 프록시로 운영 API 호출 확인
- 단위 테스트 도구는 추가하지 않는다 (요청 시 별도 결정)
