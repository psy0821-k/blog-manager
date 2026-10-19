import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedAuthToken } from './helpers/auth'

// playwright.config.ts의 webServer.env로 주입하는 로컬 더미 블로그 로그인 주소와 같은 값
const BLOG_LOGIN_ORIGIN = 'http://localhost:3999'

const REPLY = { text: 'AI 답변입니다', suggestions: [] }
const DRAFT = { title: '요약 제목', memo: '- 요약 메모', type: 'LAB' }

const SAVED = {
  id: 'idea-1',
  title: '서버가 돌려준 제목',
  memo: '- 요약 메모',
  type: 'LAB',
  status: 'todo',
  createdAt: '2026-10-19T00:00:00.000Z',
}

interface IdeaRequest {
  method: string
  authorization: string | undefined
  body: unknown
}

/** 대시보드의 글 목록 API(성실도·최근 글·임시저장)를 빈 목록으로 응답한다. */
async function mockPostApis(page: Page) {
  await page.route(/\/api\/(projects|lab|devlog)(\?|$)/, async (route) => {
    await route.fulfill({ json: { data: [], meta: { page: 1, pageSize: 30, totalCount: 0, totalPages: 1 } } })
  })
}

/** AI 호출(/ai/generate)을 가로챈다. 첫 호출은 대화 답변, 이후 호출은 글감 요약으로 응답한다. */
async function mockIdeaAi(page: Page) {
  let callCount = 0

  await page.route('**/ai/generate', async (route) => {
    callCount += 1
    const payload = callCount === 1 ? REPLY : DRAFT

    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] } })
  })
}

/** 글감 저장 요청(POST /server-api/ideas)을 가로채 기록하고 201로 응답한다. 요청 수는 응답하는 route 안에서 센다. */
async function mockIdeaApi(page: Page, delayMs = 0) {
  const requests: IdeaRequest[] = []

  await page.route('**/server-api/ideas', async (route) => {
    const request = route.request()

    // 대시보드의 글감 목록 조회(GET)는 저장 요청이 아니므로 기록하지 않고 빈 목록으로 응답한다
    if (request.method() !== 'POST') {
      await route.fulfill({ json: { data: [] } })
      return
    }

    requests.push({
      method: request.method(),
      authorization: request.headers().authorization,
      body: request.postDataJSON(),
    })

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    await route.fulfill({ status: 201, json: SAVED })
  })

  return requests
}

/**
 * 글감 저장 요청에 호출 순서대로 statuses[i]로 응답한다(넘치면 마지막 값을 반복). 201이면 저장 성공 응답이다.
 * 요청 수는 응답하는 route 안에서 센다.
 */
async function mockIdeaApiByStatus(page: Page, statuses: number[]) {
  const requests: IdeaRequest[] = []

  await page.route('**/server-api/ideas', async (route) => {
    const request = route.request()

    // 대시보드의 글감 목록 조회(GET)는 저장 요청이 아니므로 기록하지 않고 빈 목록으로 응답한다
    if (request.method() !== 'POST') {
      await route.fulfill({ json: { data: [] } })
      return
    }

    const status = statuses[Math.min(requests.length, statuses.length - 1)]
    requests.push({
      method: request.method(),
      authorization: request.headers().authorization,
      body: request.postDataJSON(),
    })

    await route.fulfill(status === 201 ? { status, json: SAVED } : { status, json: {} })
  })

  return requests
}

/** 메시지를 한 번 주고받은 뒤 "대화 저장"을 눌러 글감 초안 다이얼로그를 연다. */
async function openSaveDialog(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('메세지를 보내보세요').fill('주제')
  await page.getByRole('button', { name: /보내기/ }).click()
  await expect(page.getByText('AI 답변입니다')).toBeVisible()

  await page.getByRole('button', { name: '대화 저장' }).click()
  const dialog = page.getByRole('dialog', { name: '대화 내용을 글감으로 저장' })
  await expect(dialog).toBeVisible()

  return dialog
}

test('대화를 저장하면 POST /server-api/ideas가 Bearer 토큰과 본문으로 한 번 가고 저장 안내가 보이며 대화가 유지된다', async ({ page }) => {
  await seedAuthToken(page)
  await mockPostApis(page)
  await mockIdeaAi(page)
  const ideaRequests = await mockIdeaApi(page)

  const dialog = await openSaveDialog(page)
  await dialog.getByRole('button', { name: '저장', exact: true }).click()

  await expect(page.getByText(/서버가 돌려준 제목.*글감으로 저장했어요/)).toBeVisible()
  await expect(dialog).toBeHidden()

  expect(ideaRequests).toHaveLength(1)
  expect(ideaRequests[0].method).toBe('POST')
  expect(ideaRequests[0].authorization).toMatch(/^Bearer .+/)
  expect(ideaRequests[0].body).toEqual({ title: '요약 제목', memo: '- 요약 메모', type: 'LAB' })

  // 저장해도 대화는 그대로 남는다
  await expect(page.getByText('주제', { exact: true })).toBeVisible()
  await expect(page.getByText('AI 답변입니다')).toBeVisible()
})

test('응답이 느릴 때 저장 버튼을 두 번 눌러도 요청은 한 번만 간다', async ({ page }) => {
  await seedAuthToken(page)
  await mockPostApis(page)
  await mockIdeaAi(page)
  const ideaRequests = await mockIdeaApi(page, 500)

  const dialog = await openSaveDialog(page)
  const saveButton = dialog.getByRole('button', { name: /^저장/ })

  await saveButton.click()
  // 저장 중에는 버튼이 비활성이라 강제로 눌러도 요청이 늘지 않아야 한다
  await saveButton.click({ force: true })

  await expect(page.getByText(/서버가 돌려준 제목.*글감으로 저장했어요/)).toBeVisible()
  expect(ideaRequests).toHaveLength(1)
})

test('서버가 500이면 다이얼로그 안에 오류 문구가 보이고 입력이 유지되며, 다시 저장해 성공하면 문구가 사라지고 저장 안내가 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockPostApis(page)
  await mockIdeaAi(page)
  const ideaRequests = await mockIdeaApiByStatus(page, [500, 201])

  const dialog = await openSaveDialog(page)
  const titleInput = dialog.getByPlaceholder('제목')
  await titleInput.fill('고친 제목')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()

  await expect(dialog.getByRole('alert')).toContainText('서버 오류로 저장하지 못했어요')
  await expect(dialog.getByRole('alert')).toContainText('(500)')
  await expect(titleInput).toHaveValue('고친 제목')

  await dialog.getByRole('button', { name: '저장', exact: true }).click()

  await expect(page.getByText(/서버가 돌려준 제목.*글감으로 저장했어요/)).toBeVisible()
  await expect(dialog).toBeHidden()
  expect(ideaRequests).toHaveLength(2)
  expect(ideaRequests[1].body).toEqual({ title: '고친 제목', memo: '- 요약 메모', type: 'LAB' })
})

for (const status of [401, 403]) {
  test(`서버가 ${status}이면 블로그 로그인 주소로 이동하는 요청이 시작되고 POST는 한 번만 전송된다`, async ({ page }) => {
    await seedAuthToken(page)
    const loginRequests: string[] = []
    await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
      loginRequests.push(route.request().url())

      await route.fulfill({ contentType: 'text/html', body: '<script>location.replace("about:blank")</script>' })
    })
    await mockPostApis(page)
    await mockIdeaAi(page)
    const ideaRequests = await mockIdeaApiByStatus(page, [status])

    const dialog = await openSaveDialog(page)
    await dialog.getByRole('button', { name: '저장', exact: true }).click()

    await expect.poll(() => loginRequests.length).toBeGreaterThan(0)
    const loginUrl = new URL(loginRequests[0])

    expect(`${loginUrl.origin}${loginUrl.pathname}`).toBe(`${BLOG_LOGIN_ORIGIN}/admin-login`)
    expect(ideaRequests).toHaveLength(1)
  })
}
