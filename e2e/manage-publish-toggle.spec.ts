import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { seedAuthToken } from './helpers/auth'

// playwright.config.ts의 webServer.env로 주입하는 로컬 더미 블로그 로그인 주소와 같은 값
const BLOG_LOGIN_ORIGIN = 'http://localhost:3999'
const CREATED_AT = '2026-10-08T12:00:00Z'
const PENDING_LABEL = '처리 중…'
const PATH_BY_TYPE = { projects: 'projects', lab: 'lab', devlog: 'devlog' } as const

type ApiType = keyof typeof PATH_BY_TYPE

interface PostFixture {
  slug: string
  title: string
}

interface ServerState {
  published: PostFixture[]
  drafts: PostFixture[]
}

interface PatchRequest {
  path: string
  body: string | null
}

const POST_A: PostFixture = { slug: 'post-a', title: 'A 글 제목' }
const POST_B: PostFixture = { slug: 'post-b', title: 'B 글 제목' }

/** 서버 응답 동작. 기본은 즉시 성공이다. */
type PatchBehavior = (route: Route, apply: () => void) => Promise<void>

interface MockOptions {
  /** 글 종류별 서버 상태. 없는 종류는 빈 목록이다. */
  initial?: Partial<Record<ApiType, ServerState>>
  patchBehavior?: PatchBehavior
}

function buildListResponse(posts: PostFixture[]) {
  const data = posts.map(({ slug, title }) => ({
    id: slug,
    title,
    slug,
    viewCount: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }))

  return { data, meta: { page: 1, pageSize: 30, totalCount: data.length, totalPages: 1 } }
}

/**
 * 블로그 API를 흉내 낸다. PATCH가 성공하면 글을 한쪽 목록에서 다른 쪽으로 옮겨
 * 이후 목록 GET이 그 결과를 돌려준다.
 */
async function mockBlogApis(page: Page, { initial = {}, patchBehavior }: MockOptions = {}) {
  const servers: Record<ApiType, ServerState> = {
    projects: initial.projects ?? { published: [], drafts: [] },
    lab: initial.lab ?? { published: [], drafts: [] },
    devlog: initial.devlog ?? { published: [], drafts: [] },
  }
  const patchRequests: PatchRequest[] = []
  const listRequests: string[] = []

  await page.route(/\/api\/categories(\?|$)/, async (route) => {
    await route.fulfill({ json: [] })
  })

  await page.route(/\/api\/(projects|lab|devlog)(\?|$)/, async (route) => {
    const url = new URL(route.request().url())
    const type = url.pathname.split('/')[2] as ApiType
    listRequests.push(`${type}?${url.searchParams.toString()}`)
    const state = servers[type]

    await route.fulfill({ json: buildListResponse(url.searchParams.get('draft') === 'true' ? state.drafts : state.published) })
  })

  await page.route(/\/api\/(projects|lab|devlog)\/[^/?]+$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const [, , type, slug] = url.pathname.split('/')
    const state = servers[type as ApiType]
    patchRequests.push({ path: url.pathname, body: request.postData() })

    const body = JSON.parse(request.postData() ?? '{}') as { published?: boolean }
    const apply = () => {
      const [from, to] = body.published ? [state.drafts, state.published] : [state.published, state.drafts]
      const index = from.findIndex((post) => post.slug === slug)

      if (index >= 0) {
        to.push(...from.splice(index, 1))
      }
    }

    if (patchBehavior) {
      await patchBehavior(route, apply)
      return
    }

    apply()
    await route.fulfill({ json: {} })
  })

  return { patchRequests, listRequests }
}

/** 테스트가 해제할 때까지 응답을 붙잡는 게이트 */
function createGate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

function rowOf(page: Page, title: string) {
  return page.getByRole('row').filter({ hasText: title })
}

test('임시저장 보기에서 발행을 누르면 응답 전까지 처리 중이고 본문이 published true이며 응답 뒤 목록에서 사라지고 발행됨 탭에 나타난다', async ({ page }) => {
  await seedAuthToken(page)
  const gate = createGate()
  const { patchRequests } = await mockBlogApis(page, {
    initial: { projects: { published: [], drafts: [POST_A] } },
    patchBehavior: async (route, apply) => {
      await gate.promise
      apply()
      await route.fulfill({ json: {} })
    },
  })
  await page.goto('/manage?draft=true')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  await rowOf(page, POST_A.title).getByRole('button', { name: '발행' }).click()

  const pendingButton = rowOf(page, POST_A.title).getByRole('button', { name: PENDING_LABEL })
  await expect(pendingButton).toBeVisible()
  await expect(pendingButton).toBeDisabled()
  await expect.poll(() => patchRequests.length).toBe(1)
  expect(patchRequests[0].body).toBe('{"published":true}')

  gate.release()

  await expect(page.getByText(POST_A.title)).toHaveCount(0)

  await page.getByRole('tab', { name: '발행됨' }).click()

  await expect(page.getByText(POST_A.title)).toBeVisible()
})

test('발행됨 보기에서 임시저장으로 전환을 누르면 본문이 published false이고 목록에서 사라지며 임시저장 탭에 나타난다', async ({ page }) => {
  await seedAuthToken(page)
  const { patchRequests } = await mockBlogApis(page, { initial: { projects: { published: [POST_A], drafts: [] } } })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  await rowOf(page, POST_A.title).getByRole('button', { name: '임시저장으로 전환' }).click()

  await expect(page.getByText(POST_A.title)).toHaveCount(0)
  expect(patchRequests).toHaveLength(1)
  expect(patchRequests[0].body).toBe('{"published":false}')

  await page.getByRole('tab', { name: '임시저장' }).click()

  await expect(page.getByText(POST_A.title)).toBeVisible()
})

test('랩 탭에서 전환하면 요청이 /api/lab/<slug>로 가고 목록이 갱신된다', async ({ page }) => {
  await seedAuthToken(page)
  const { patchRequests } = await mockBlogApis(page, { initial: { lab: { published: [POST_A], drafts: [] } } })
  await page.goto('/manage?type=LAB')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  await rowOf(page, POST_A.title).getByRole('button', { name: '임시저장으로 전환' }).click()

  await expect(page.getByText(POST_A.title)).toHaveCount(0)
  expect(patchRequests.map(({ path }) => path)).toEqual([`/api/lab/${POST_A.slug}`])
})

test('한 글의 PATCH가 지연되면 그 행만 처리 중이고 다른 글 버튼은 활성이며 연달아 눌러도 PATCH는 한 번만 전송된다', async ({ page }) => {
  await seedAuthToken(page)
  const gate = createGate()
  const { patchRequests } = await mockBlogApis(page, {
    initial: { projects: { published: [POST_A, POST_B], drafts: [] } },
    patchBehavior: async (route, apply) => {
      await gate.promise
      apply()
      await route.fulfill({ json: {} })
    },
  })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  await rowOf(page, POST_A.title).getByRole('button', { name: '임시저장으로 전환' }).click()

  const pendingButton = rowOf(page, POST_A.title).getByRole('button', { name: PENDING_LABEL })
  await expect(pendingButton).toBeDisabled()
  await expect(rowOf(page, POST_B.title).getByRole('button', { name: '임시저장으로 전환' })).toBeEnabled()

  await pendingButton.click({ force: true, clickCount: 3 })
  await expect.poll(() => patchRequests.length).toBe(1)
  // 중복 요청이 늦게 도착하는 경우를 놓치지 않도록 잠시 더 기다린다
  await page.waitForTimeout(500)

  expect(patchRequests).toHaveLength(1)

  gate.release()

  await expect(page.getByText(POST_A.title)).toHaveCount(0)
  await expect(page.getByText(POST_B.title)).toBeVisible()
})

test('PATCH가 500이면 표 위에 사유가 보이고 글들이 그대로이며 버튼이 다시 활성화된다', async ({ page }) => {
  await seedAuthToken(page)
  await mockBlogApis(page, {
    initial: { projects: { published: [POST_A, POST_B], drafts: [] } },
    patchBehavior: async (route) => {
      await route.fulfill({ status: 500, json: {} })
    },
  })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  await rowOf(page, POST_A.title).getByRole('button', { name: '임시저장으로 전환' }).click()

  await expect(page.getByRole('alert')).toHaveText('상태를 바꾸지 못했습니다. (500)')
  await expect(page.getByText(POST_A.title)).toBeVisible()
  await expect(page.getByText(POST_B.title)).toBeVisible()
  await expect(rowOf(page, POST_A.title).getByRole('button', { name: '임시저장으로 전환' })).toBeEnabled()
})

test('PATCH가 네트워크 오류로 끊기면 네트워크 오류 문구가 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockBlogApis(page, {
    initial: { projects: { published: [POST_A], drafts: [] } },
    patchBehavior: async (route) => {
      await route.abort()
    },
  })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  await rowOf(page, POST_A.title).getByRole('button', { name: '임시저장으로 전환' }).click()

  await expect(page.getByRole('alert')).toHaveText('네트워크 오류로 상태를 바꾸지 못했습니다.')
  await expect(page.getByText(POST_A.title)).toBeVisible()
})

test('PATCH가 404이면 이미 삭제된 글입니다가 보이고 목록이 다시 불러와져 그 글이 사라진다', async ({ page }) => {
  await seedAuthToken(page)
  let removedOnServer = false
  // 이 route가 mockBlogApis의 목록 route보다 먼저 실행되고 fallback 없이 응답하므로, 404 이후의 재조회는 여기서 직접 센다
  let refetchesAfter404 = 0
  await mockBlogApis(page, {
    initial: { projects: { published: [POST_A, POST_B], drafts: [] } },
    patchBehavior: async (route) => {
      removedOnServer = true
      await route.fulfill({ status: 404, json: {} })
    },
  })
  // 404 이후의 목록 조회는 글이 삭제된 상태로 응답한다
  await page.route(/\/api\/projects(\?|$)/, async (route) => {
    if (removedOnServer) {
      refetchesAfter404 += 1
      await route.fulfill({ json: buildListResponse([POST_B]) })
      return
    }

    await route.fallback()
  })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  await rowOf(page, POST_A.title).getByRole('button', { name: '임시저장으로 전환' }).click()

  await expect(page.getByRole('alert')).toHaveText('이미 삭제된 글입니다')
  await expect(page.getByText(POST_A.title)).toHaveCount(0)
  await expect(page.getByText(POST_B.title)).toBeVisible()
  expect(refetchesAfter404).toBe(1)
})

for (const status of [401, 403]) {
  test(`PATCH가 ${status}이면 블로그 로그인 주소로 이동하는 요청이 시작된다`, async ({ page }) => {
    await seedAuthToken(page)
    const loginRequests: string[] = []
    await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
      loginRequests.push(route.request().url())

      await route.fulfill({ contentType: 'text/html', body: '<script>location.replace("about:blank")</script>' })
    })
    await mockBlogApis(page, {
      initial: { projects: { published: [POST_A], drafts: [] } },
      patchBehavior: async (route) => {
        await route.fulfill({ status, json: {} })
      },
    })
    await page.goto('/manage')
    await expect(page.getByText(POST_A.title)).toBeVisible()

    await rowOf(page, POST_A.title).getByRole('button', { name: '임시저장으로 전환' }).click()

    await expect.poll(() => loginRequests.length).toBeGreaterThan(0)
    const loginUrl = new URL(loginRequests[0])

    expect(`${loginUrl.origin}${loginUrl.pathname}`).toBe(`${BLOG_LOGIN_ORIGIN}/admin-login`)
  })
}
