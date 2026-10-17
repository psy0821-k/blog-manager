# 트러블슈팅

## Gemini 연동 (아이디어 생성)

### 1. 같은 키가 200에서 401로 바뀜 (`ACCESS_TOKEN_TYPE_UNSUPPORTED`)

- **증상**: 처음 curl은 HTTP 200이었는데, 잠시 뒤 같은 키로 직접 호출해도 401 `API key not valid` / `reason: ACCESS_TOKEN_TYPE_UNSUPPORTED`가 나왔다. Vite 프록시를 거쳐도 같았다.
- **판단**: 프록시 문제가 아니다. 직접 호출도 같은 401이고, Google 응답 본문이 프록시를 거쳐 그대로 돌아왔다(경로·rewrite는 정상). `AQ.`로 시작하는 값은 장기 API 키가 아니라 만료되는 임시 토큰일 가능성이 크다.
- **조치**: AI Studio에서 장기 API 키(보통 `AIza...`)를 새로 발급해 `.env`의 `GEMINI_API_KEY`에 넣고 개발 서버를 재시작한다.
- **교훈**: 키 문제와 코드 문제를 가르려면 프록시를 빼고 직접 호출해서 비교한다.

### 2. 키를 브라우저에 노출하지 않는 구조

- 이 앱은 브라우저 전용이고 `server/`가 없다. `VITE_` 변수나 SDK로 키를 브라우저에서 쓰면 번들에 들어간다.
- 그래서 `vite.config.ts`의 `/ai/generate` 프록시가 `GEMINI_API_KEY`를 `x-goog-api-key` 헤더로만 붙이고, 모델·경로(`gemini-flash-latest:generateContent`)는 서버 쪽에 고정한다.
- **한계**: 개발 서버에서만 동작한다. 배포하려면 `server/` 같은 별도 백엔드가 필요하다.
- 키를 대화나 문서에 붙여 넣었다면 노출된 것으로 보고 재발급한다.

### 3. `@google/genai` SDK를 쓰지 않은 이유

- AI Studio 공식 SDK이고 문서의 기본 호출은 `ai.interactions.create`와 `response_format`이다. 이 프로젝트는 `generateContent`와 `responseSchema`를 `fetch`로 직접 호출한다.
- SDK는 `GEMINI_API_KEY` 환경변수를 읽는 서버 사용을 전제로 한다. 브라우저에서 쓰면 키가 노출되므로 `server/`가 생기기 전에는 도입하지 않는다.
- 설치했다가 되돌렸다(`npm uninstall @google/genai`). `server/`를 만들 때 SDK 사용을 다시 검토한다.
