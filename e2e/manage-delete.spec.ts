import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { seedAuthToken } from './helpers/auth'

// playwright.config.ts의 webServer.env로 주입하는 로컬 더미 블로그 로그인 주소와 같은 값
const BLOG_LOGIN_ORIGIN = 'http://localhost:3999'
const CREATED_AT = '2026-10-08T12:00:00Z'
const DELETING_LABEL = '삭제 중…'
const DEFAULT_PAGE_SIZE = 2
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

interface WriteRequest {
  method: string
  path: string
  body: string | null
}

const POST_A: PostFixture = { slug: 'post-a', title: 'A 글 제목' }
const POST_B: PostFixture = { slug: 'post-b', title: 'B 글 제목' }
const POST_C: PostFixture = { slug: 'post-c', title: 'C 글 제목' }

/** DELETE 응답 동작. apply()를 부르면 서버 상태에서 글이 제거된다. 기본은 apply() 후 본문 없는 204다. */
type DeleteBehavior = (route: Route, apply: () => void) => Promise<void>

interface MockOptions {
  /** 글 종류별 서버 상태. 없는 종류는 빈 목록이다. */
  initial?: Partial<Record<ApiType, ServerState>>
  /** 서버가 돌려주는 페이지 크기. 클라이언트는 pageSize를 보내지 않는다. */
  pageSize?: number
  deleteBehavior?: DeleteBehavior
}

function buildListResponse(posts: PostFixture[], pageParam: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize))
  const data = posts.slice((pageParam - 1) * pageSize, pageParam * pageSize).map(({ slug, title }) => ({
    id: slug,
    title,
    slug,
    viewCount: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }))

  return { data, meta: { page: pageParam, pageSize, totalCount: posts.length, totalPages } }
}

/**
 * 블로그 API를 흉내 낸다. route는 목록·항목 각각 한 번만 등록하고,
 * 요청 기록은 handler 안에서 남긴다. 분기(404 포함)는 서버 상태와 deleteBehavior로 표현한다.
 */
async function mockBlogApis(page: Page, { initial = {}, pageSize = DEFAULT_PAGE_SIZE, deleteBehavior }: MockOptions = {}) {
  const servers: Record<ApiType, ServerState> = {
    projects: initial.projects ?? { published: [], drafts: [] },
    lab: initial.lab ?? { published: [], drafts: [] },
    devlog: initial.devlog ?? { published: [], drafts: [] },
  }
  const deleteRequests: WriteRequest[] = []
  const patchRequests: WriteRequest[] = []
  const listRequests: string[] = []

  await page.route(/\/api\/categories(\?|$)/, async (route) => {
    await route.fulfill({ json: [] })
  })

  await page.route(/\/api\/(projects|lab|devlog)(\?|$)/, async (route) => {
    const url = new URL(route.request().url())
    const type = url.pathname.split('/')[2] as ApiType
    listRequests.push(`${type}?${url.searchParams.toString()}`)
    const state = servers[type]
    const posts = url.searchParams.get('draft') === 'true' ? state.drafts : state.published
    const pageParam = Number(url.searchParams.get('page') ?? '1') || 1

    await route.fulfill({ json: buildListResponse(posts, pageParam, pageSize) })
  })

  await page.route(/\/api\/(projects|lab|devlog)\/[^/?]+$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const [, , type, slug] = url.pathname.split('/')
    const state = servers[type as ApiType]
    const record: WriteRequest = { method: request.method(), path: url.pathname, body: request.postData() }

    if (request.method() === 'DELETE') {
      deleteRequests.push(record)
      const apply = () => {
        state.published = state.published.filter((post) => post.slug !== slug)
        state.drafts = state.drafts.filter((post) => post.slug !== slug)
      }

      if (deleteBehavior) {
        await deleteBehavior(route, apply)
        return
      }

      apply()
      await route.fulfill({ status: 204 })
      return
    }

    patchRequests.push(record)
    await route.fulfill({ json: {} })
  })

  return { deleteRequests, patchRequests, listRequests }
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

async function openDeleteDialog(page: Page, title: string) {
  await rowOf(page, title).getByRole('button', { name: '삭제' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  return dialog
}

test('삭제를 누르면 확인 대화상자가 열리고 DELETE는 0건이며 취소를 누르면 닫히고 요청 없이 목록이 그대로다', async ({ page }) => {
  await seedAuthToken(page)
  const { deleteRequests } = await mockBlogApis(page, { initial: { projects: { published: [POST_A, POST_B], drafts: [] } } })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  const dialog = await openDeleteDialog(page, POST_A.title)

  await expect(dialog.getByText('「A 글 제목」을 삭제할까요? 되돌릴 수 없습니다.')).toBeVisible()
  expect(deleteRequests).toHaveLength(0)

  await dialog.getByRole('button', { name: '취소' }).click()

  await expect(dialog).toBeHidden()
  expect(deleteRequests).toHaveLength(0)
  await expect(page.getByText(POST_A.title)).toBeVisible()
  await expect(page.getByText(POST_B.title)).toBeVisible()
})

test('Esc를 누르면 대화상자가 닫히고 요청이 없으며 열려 있는 동안 배경 행 버튼을 좌표 클릭해도 요청이 가지 않는다', async ({ page }) => {
  await seedAuthToken(page)
  const { deleteRequests, patchRequests } = await mockBlogApis(page, {
    initial: { projects: { published: [POST_A, POST_B], drafts: [] } },
  })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  const dialog = await openDeleteDialog(page, POST_A.title)
  await page.keyboard.press('Escape')

  await expect(dialog).toBeHidden()
  expect(deleteRequests).toHaveLength(0)

  // 배경 행의 전환 버튼 위치를 잡아 두고 대화상자를 다시 연 뒤 그 좌표를 누른다
  const toggleBox = await rowOf(page, POST_B.title).getByRole('button', { name: '임시저장으로 전환' }).boundingBox()
  if (!toggleBox) throw new Error('전환 버튼의 위치를 찾을 수 없다')

  await openDeleteDialog(page, POST_A.title)
  await page.mouse.click(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2)
  await page.waitForTimeout(300)

  expect(deleteRequests).toHaveLength(0)
  expect(patchRequests).toHaveLength(0)
})

test('삭제를 누르면 DELETE 응답이 지연되는 동안 삭제 중…과 취소가 비활성이고 Esc로 닫히지 않으며 연타해도 한 번만 전송되고 해제하면 닫히며 글이 사라진다', async ({ page }) => {
  await seedAuthToken(page)
  const gate = createGate()
  const { deleteRequests } = await mockBlogApis(page, {
    initial: { projects: { published: [POST_A, POST_B], drafts: [] } },
    deleteBehavior: async (route, apply) => {
      await gate.promise
      apply()
      await route.fulfill({ status: 204 })
    },
  })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()
  const dialog = await openDeleteDialog(page, POST_A.title)

  await dialog.getByRole('button', { name: '삭제' }).click()

  const deletingButton = dialog.getByRole('button', { name: DELETING_LABEL })
  await expect(deletingButton).toBeDisabled()
  await expect(dialog.getByRole('button', { name: '취소' })).toBeDisabled()

  await page.keyboard.press('Escape')

  await expect(dialog).toBeVisible()

  await deletingButton.click({ force: true, clickCount: 3 })
  await expect.poll(() => deleteRequests.length).toBe(1)
  // 중복 요청이 늦게 도착하는 경우를 놓치지 않도록 잠시 더 기다린다
  await page.waitForTimeout(500)

  expect(deleteRequests).toHaveLength(1)
  expect(deleteRequests[0].method).toBe('DELETE')
  expect(deleteRequests[0].path).toBe(`/api/projects/${POST_A.slug}`)
  expect(deleteRequests[0].body).toBeNull()

  gate.release()

  await expect(dialog).toBeHidden()
  await expect(page.getByText(POST_A.title)).toHaveCount(0)
  await expect(page.getByText(POST_B.title)).toBeVisible()
})

test('2쪽의 마지막 글을 삭제하면 URL이 page=1이 되고 1쪽의 두 글이 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockBlogApis(page, { initial: { projects: { published: [POST_A, POST_B, POST_C], drafts: [] } } })
  await page.goto('/manage?page=2')
  await expect(page.getByText(POST_C.title)).toBeVisible()

  const dialog = await openDeleteDialog(page, POST_C.title)
  await dialog.getByRole('button', { name: '삭제' }).click()

  await expect(page).toHaveURL(/page=1/)
  await expect(page.getByText(POST_A.title)).toBeVisible()
  await expect(page.getByText(POST_B.title)).toBeVisible()
  await expect(page.getByText(POST_C.title)).toHaveCount(0)
})

test('임시저장 보기에서 삭제하면 재조회가 draft=true로 가고 글이 사라지며 draft=true가 유지된다', async ({ page }) => {
  await seedAuthToken(page)
  const { listRequests } = await mockBlogApis(page, { initial: { projects: { published: [], drafts: [POST_A, POST_B] } } })
  await page.goto('/manage?draft=true')
  await expect(page.getByText(POST_A.title)).toBeVisible()
  const beforeCount = listRequests.length

  const dialog = await openDeleteDialog(page, POST_A.title)
  await dialog.getByRole('button', { name: '삭제' }).click()

  await expect(page.getByText(POST_A.title)).toHaveCount(0)
  await expect(page.getByText(POST_B.title)).toBeVisible()
  expect(listRequests.length).toBeGreaterThan(beforeCount)
  expect(listRequests[listRequests.length - 1]).toContain('draft=true')
  await expect(page).toHaveURL(/draft=true/)
})

test('랩 탭에서 삭제하면 요청이 /api/lab/<slug>로 가고 목록이 갱신된다', async ({ page }) => {
  await seedAuthToken(page)
  const { deleteRequests } = await mockBlogApis(page, { initial: { lab: { published: [POST_A, POST_B], drafts: [] } } })
  await page.goto('/manage?type=LAB')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  const dialog = await openDeleteDialog(page, POST_A.title)
  await dialog.getByRole('button', { name: '삭제' }).click()

  await expect(page.getByText(POST_A.title)).toHaveCount(0)
  expect(deleteRequests.map(({ path }) => path)).toEqual([`/api/lab/${POST_A.slug}`])
})

test('DELETE가 500이면 대화상자가 닫히고 표 위에 사유가 보이며 글이 그대로이고 삭제가 다시 활성화된다', async ({ page }) => {
  await seedAuthToken(page)
  await mockBlogApis(page, {
    initial: { projects: { published: [POST_A, POST_B], drafts: [] } },
    deleteBehavior: async (route) => {
      await route.fulfill({ status: 500, json: {} })
    },
  })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  const dialog = await openDeleteDialog(page, POST_A.title)
  await dialog.getByRole('button', { name: '삭제' }).click()

  await expect(page.getByRole('alert')).toHaveText('삭제하지 못했습니다. (500)')
  await expect(dialog).toBeHidden()
  await expect(page.getByText(POST_A.title)).toBeVisible()
  await expect(page.getByText(POST_B.title)).toBeVisible()
  await expect(rowOf(page, POST_A.title).getByRole('button', { name: '삭제' })).toBeEnabled()
})

test('DELETE가 네트워크 오류로 끊기면 네트워크 오류 문구가 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockBlogApis(page, {
    initial: { projects: { published: [POST_A], drafts: [] } },
    deleteBehavior: async (route) => {
      await route.abort()
    },
  })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()

  const dialog = await openDeleteDialog(page, POST_A.title)
  await dialog.getByRole('button', { name: '삭제' }).click()

  await expect(page.getByRole('alert')).toHaveText('네트워크 오류로 삭제하지 못했습니다.')
  await expect(page.getByText(POST_A.title)).toBeVisible()
})

test('DELETE가 404이면 이미 삭제된 글입니다가 보이고 목록이 다시 불러와져 그 글이 사라진다', async ({ page }) => {
  await seedAuthToken(page)
  const { listRequests } = await mockBlogApis(page, {
    initial: { projects: { published: [POST_A, POST_B], drafts: [] } },
    // 서버에서는 이미 지워진 상태로 404를 돌려준다
    deleteBehavior: async (route, apply) => {
      apply()
      await route.fulfill({ status: 404, json: {} })
    },
  })
  await page.goto('/manage')
  await expect(page.getByText(POST_A.title)).toBeVisible()
  const beforeCount = listRequests.length

  const dialog = await openDeleteDialog(page, POST_A.title)
  await dialog.getByRole('button', { name: '삭제' }).click()

  await expect(page.getByRole('alert')).toHaveText('이미 삭제된 글입니다')
  await expect(page.getByText(POST_A.title)).toHaveCount(0)
  await expect(page.getByText(POST_B.title)).toBeVisible()
  expect(listRequests.length).toBeGreaterThan(beforeCount)
})

for (const status of [401, 403]) {
  test(`DELETE가 ${status}이면 블로그 로그인 주소로 이동하는 요청이 시작되고 DELETE는 한 번만 전송된다`, async ({ page }) => {
    await seedAuthToken(page)
    const loginRequests: string[] = []
    await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
      loginRequests.push(route.request().url())

      await route.fulfill({ contentType: 'text/html', body: '<script>location.replace("about:blank")</script>' })
    })
    const { deleteRequests } = await mockBlogApis(page, {
      initial: { projects: { published: [POST_A], drafts: [] } },
      deleteBehavior: async (route) => {
        await route.fulfill({ status, json: {} })
      },
    })
    await page.goto('/manage')
    await expect(page.getByText(POST_A.title)).toBeVisible()

    const dialog = await openDeleteDialog(page, POST_A.title)
    await dialog.getByRole('button', { name: '삭제' }).click()

    await expect.poll(() => loginRequests.length).toBeGreaterThan(0)
    const loginUrl = new URL(loginRequests[0])

    expect(`${loginUrl.origin}${loginUrl.pathname}`).toBe(`${BLOG_LOGIN_ORIGIN}/admin-login`)
    expect(deleteRequests).toHaveLength(1)
  })
}

test('프로젝트 글의 대화상자가 열린 뒤 브라우저 뒤로 가기로 type이 LAB으로 바뀌어도 DELETE는 /api/projects/<slug>로만 간다', async ({ page }) => {
  const labPost: PostFixture = { slug: POST_A.slug, title: '랩의 같은 slug 글' }
  await seedAuthToken(page)
  const { deleteRequests } = await mockBlogApis(page, {
    initial: {
      projects: { published: [POST_A, POST_B], drafts: [] },
      lab: { published: [labPost], drafts: [] },
    },
  })
  await page.goto('/manage?type=LAB')
  await expect(page.getByText(labPost.title)).toBeVisible()

  // 앱 안의 history 항목을 하나 쌓아 두고(프로젝트 보기), 뒤로 가기가 같은 문서 안의 LAB 항목으로 돌아가게 한다
  await page.evaluate(() => {
    const state = window.history.state as { idx?: number } | null
    window.history.pushState({ ...state, key: 'e2e-project', idx: (state?.idx ?? 0) + 1 }, '', '/manage')
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
  })
  await expect(page.getByText(POST_A.title)).toBeVisible()

  const dialog = await openDeleteDialog(page, POST_A.title)

  await page.goBack()
  await expect(page).toHaveURL(/type=LAB/)
  await expect(page.getByText(labPost.title)).toBeVisible()
  await expect(dialog.getByText('「A 글 제목」을 삭제할까요? 되돌릴 수 없습니다.')).toBeVisible()

  await dialog.getByRole('button', { name: '삭제' }).click()

  await expect.poll(() => deleteRequests.length).toBeGreaterThan(0)
  // 잘못된 엔드포인트 요청이 늦게 도착하는 경우를 놓치지 않도록 잠시 더 기다린다
  await page.waitForTimeout(300)

  expect(deleteRequests.map(({ path }) => path)).toEqual([`/api/projects/${POST_A.slug}`])
})
