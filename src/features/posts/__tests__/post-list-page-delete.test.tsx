import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api-client'
import { fetchCategories } from '../../categories/categories-api'
import { PostListPage } from '../post-list-page'
import type { PostListItem, PostListResponse } from '../post-types'
import { deletePost, fetchPostList, updatePostPublished } from '../posts-api'

vi.mock('@/lib/env', () => ({ BLOG_API_URL: '', BLOG_LOGIN_URL: 'https://blog.example/admin-login' }))
vi.mock('../posts-api', () => ({ fetchPostList: vi.fn(), updatePostPublished: vi.fn(), deletePost: vi.fn() }))
vi.mock('../../categories/categories-api', () => ({ fetchCategories: vi.fn() }))

const mockedFetchPostList = vi.mocked(fetchPostList)
const mockedUpdate = vi.mocked(updatePostPublished)
const mockedDelete = vi.mocked(deletePost)
const mockedFetchCategories = vi.mocked(fetchCategories)

const PENDING_LABEL = '처리 중…'
const DELETING_LABEL = '삭제 중…'
const FIRST = { slug: 'first-slug', title: '첫 글' }
const SECOND = { slug: 'second-slug', title: '둘째 글' }
const THIRD = { slug: 'third-slug', title: '셋째 글' }
const FOURTH = { slug: 'fourth-slug', title: '넷째 글' }

function makeItem({ slug, title }: { slug: string; title: string }): PostListItem {
  const date = '2026-10-08T12:00:00Z'
  return { id: slug, title, slug, viewCount: 0, createdAt: date, updatedAt: date }
}

/** 서버가 쪽(page)별로 가진 목록을 흉내 낸다. 테스트가 바꾸면 이후 조회에 반영된다. */
let serverPages: Record<number, PostListItem[]>

function buildResponse(page: number): PostListResponse {
  const data = serverPages[page] ?? []
  const totalPages = Math.max(1, ...Object.entries(serverPages).filter(([, items]) => items.length > 0).map(([key]) => Number(key)))

  return { data, meta: { page, pageSize: 30, totalCount: data.length, totalPages } }
}

/** 라우터 안에서 navigate를 꺼내 두는 테스트용 컴포넌트. 브라우저 뒤로/앞으로 가기의 URL 변경을 흉내 낸다. */
let navigateTo: (to: string) => void

function NavigateProbe() {
  const navigate = useNavigate()
  navigateTo = (to) => void navigate(to)

  return null
}

function renderPage(entry = '/manage') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <NavigateProbe />
      <PostListPage />
    </MemoryRouter>,
  )
}

/** Radix 모달이 UI 클릭을 막으므로 URL은 라우터 API로 바꾼다. */
function changeUrl(to: string) {
  act(() => navigateTo(to))
}

function rowOf(title: string): HTMLElement {
  const row = screen.getByText(title).closest('tr')
  if (!row) throw new Error('행을 찾을 수 없다')
  return row
}

/** 테스트가 끝나는 시점을 쥐는 지연된 요청 */
function createDeferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

/** 행의 삭제 버튼을 눌러 대화상자를 열고 대화상자를 돌려준다. */
async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>, title: string): Promise<HTMLElement> {
  await user.click(within(rowOf(title)).getByRole('button', { name: '삭제' }))

  return screen.findByRole('dialog')
}

async function confirmDelete(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.click(within(dialog).getByRole('button', { name: '삭제' }))
}

async function waitForDialogClosed() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

function fetchPages(): number[] {
  return mockedFetchPostList.mock.calls.map(([params]) => params.page ?? 1)
}

beforeEach(() => {
  mockedFetchPostList.mockReset()
  mockedUpdate.mockReset()
  mockedDelete.mockReset()
  mockedFetchCategories.mockReset()
  mockedFetchCategories.mockResolvedValue([])
  mockedUpdate.mockResolvedValue(undefined)
  mockedDelete.mockResolvedValue(undefined)
  serverPages = { 1: [makeItem(FIRST), makeItem(SECOND)] }
  mockedFetchPostList.mockImplementation(async (params) => buildResponse(params.page ?? 1))
})

describe('PostListPage 글 삭제', () => {
  describe('정상', () => {
    it('행의 삭제를 누르면 확인 대화상자가 열리고 deletePost와 추가 조회는 일어나지 않아야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length

      const dialog = await openDeleteDialog(user, FIRST.title)

      expect(within(dialog).getByText('「첫 글」을 삭제할까요? 되돌릴 수 없습니다.')).toBeInTheDocument()
      expect(mockedDelete).not.toHaveBeenCalled()
      expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls)
    })

    it('대화상자 삭제를 누르면 deletePost가 한 번 호출되고 요청 중 삭제 중…과 취소가 disabled이며 성공하면 닫히고 재조회로 그 글이 사라져야 한다', async () => {
      const user = userEvent.setup()
      const deferred = createDeferred()
      mockedDelete.mockReturnValue(deferred.promise)
      renderPage()
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      const dialog = await openDeleteDialog(user, FIRST.title)

      await confirmDelete(user, dialog)

      expect(mockedDelete).toHaveBeenCalledTimes(1)
      expect(mockedDelete).toHaveBeenCalledWith('PROJECT', FIRST.slug)
      expect(within(dialog).getByRole('button', { name: DELETING_LABEL })).toBeDisabled()
      expect(within(dialog).getByRole('button', { name: '취소' })).toBeDisabled()

      serverPages = { 1: [makeItem(SECOND)] }
      deferred.resolve()

      await waitForDialogClosed()
      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      await waitFor(() => expect(screen.queryByText(FIRST.title)).not.toBeInTheDocument())
      expect(screen.getByText(SECOND.title)).toBeInTheDocument()
    })

    it('재조회는 현재 보기, 페이지, 검색, 카테고리 그대로 해야 한다', async () => {
      const user = userEvent.setup()
      renderPage('/manage?page=1&q=abc&category=react&draft=true')
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      const dialog = await openDeleteDialog(user, FIRST.title)

      await confirmDelete(user, dialog)

      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      expect(mockedFetchPostList.mock.calls[initialCalls][0]).toEqual({
        type: 'PROJECT',
        page: 1,
        q: 'abc',
        category: 'react',
        draft: true,
      })
    })

    it('2쪽의 마지막 글을 삭제하면 page 1로 한 번 조회하고 옛 page 2 재조회는 없으며 이전 페이지 목록이 보여야 한다', async () => {
      const user = userEvent.setup()
      serverPages = { 1: [makeItem(SECOND)], 2: [makeItem(FIRST)] }
      renderPage('/manage?page=2')
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      const dialog = await openDeleteDialog(user, FIRST.title)
      serverPages = { 1: [makeItem(SECOND)] }

      await confirmDelete(user, dialog)

      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      expect(fetchPages().slice(initialCalls)).toEqual([1])
      expect(await screen.findByText(SECOND.title)).toBeInTheDocument()
      expect(screen.queryByText(FIRST.title)).not.toBeInTheDocument()
    })

    it('2쪽에 글이 여러 건이면 삭제 뒤 같은 page 2로 다시 조회해야 한다', async () => {
      const user = userEvent.setup()
      serverPages = { 1: [makeItem(FIRST)], 2: [makeItem(THIRD), makeItem(FOURTH)] }
      renderPage('/manage?page=2')
      await screen.findByText(THIRD.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      const dialog = await openDeleteDialog(user, THIRD.title)
      serverPages = { 1: [makeItem(FIRST)], 2: [makeItem(FOURTH)] }

      await confirmDelete(user, dialog)

      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      expect(fetchPages().slice(initialCalls)).toEqual([2])
      await waitFor(() => expect(screen.queryByText(THIRD.title)).not.toBeInTheDocument())
      expect(screen.getByText(FOURTH.title)).toBeInTheDocument()
    })

    it('랩 탭에서 삭제하면 deletePost(LAB, slug)를 호출하고 같은 방식으로 목록이 갱신돼야 한다', async () => {
      const user = userEvent.setup()
      renderPage('/manage?type=LAB')
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      const dialog = await openDeleteDialog(user, FIRST.title)

      await confirmDelete(user, dialog)

      expect(mockedDelete).toHaveBeenCalledWith('LAB', FIRST.slug)
      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      expect(mockedFetchPostList.mock.calls[initialCalls][0]).toMatchObject({ type: 'LAB' })
    })
  })

  describe('대화상자를 연 뒤 URL이 바뀌는 경우(뒤로/앞으로 가기)', () => {
    it('[예외/보안] 프로젝트 글의 대화상자가 열린 뒤 URL의 type이 LAB으로 바뀌어도 삭제는 PROJECT 종류로만 가야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText(FIRST.title)
      const dialog = await openDeleteDialog(user, FIRST.title)

      changeUrl('/manage?type=LAB')
      await waitFor(() => expect(mockedFetchPostList.mock.calls.some(([params]) => params.type === 'LAB')).toBe(true))
      expect(within(screen.getByRole('dialog')).getByText('「첫 글」을 삭제할까요? 되돌릴 수 없습니다.')).toBeInTheDocument()

      await confirmDelete(user, dialog)

      expect(mockedDelete).toHaveBeenCalledTimes(1)
      expect(mockedDelete).toHaveBeenCalledWith('PROJECT', FIRST.slug)
      expect(mockedDelete).not.toHaveBeenCalledWith('LAB', expect.anything())
    })

    it('[예외/보안] 같은 slug가 LAB에도 있는 상황에서 type이 바뀌어도 LAB 엔드포인트로는 요청이 가지 않아야 한다', async () => {
      const user = userEvent.setup()
      mockedFetchPostList.mockImplementation(async (params) =>
        params.type === 'LAB'
          ? { data: [makeItem({ slug: FIRST.slug, title: '랩의 같은 slug 글' })], meta: { page: 1, pageSize: 30, totalCount: 1, totalPages: 1 } }
          : buildResponse(params.page ?? 1),
      )
      renderPage()
      await screen.findByText(FIRST.title)
      const dialog = await openDeleteDialog(user, FIRST.title)

      changeUrl('/manage?type=LAB')
      await screen.findByText('랩의 같은 slug 글')

      await confirmDelete(user, dialog)

      expect(mockedDelete.mock.calls.map(([type, slug]) => [type, slug])).toEqual([['PROJECT', FIRST.slug]])
    })

    it('[경계] 대화상자가 열린 뒤 보기(draft)·검색어·페이지가 바뀌어도 삭제 요청의 type과 slug는 처음 연 글을 가리켜야 한다', async () => {
      const user = userEvent.setup()
      serverPages = { 1: [makeItem(FIRST), makeItem(SECOND)], 2: [makeItem(THIRD)] }
      renderPage()
      await screen.findByText(FIRST.title)
      const dialog = await openDeleteDialog(user, FIRST.title)

      changeUrl('/manage?type=DEV_LOG&draft=true&q=zzz&page=2')
      await waitFor(() => expect(mockedFetchPostList.mock.calls.some(([params]) => params.type === 'DEV_LOG')).toBe(true))

      await confirmDelete(user, dialog)

      expect(mockedDelete.mock.calls.map(([type, slug]) => [type, slug])).toEqual([['PROJECT', FIRST.slug]])
    })

    it('[경계] 삭제 대상 글이 현재 목록에 없으면 2쪽 이상이라도 이전 페이지로 이동하지 않고 같은 페이지를 다시 조회해야 한다', async () => {
      const user = userEvent.setup()
      serverPages = { 1: [makeItem(SECOND)], 2: [makeItem(FIRST)] }
      renderPage('/manage?page=2')
      await screen.findByText(FIRST.title)
      const dialog = await openDeleteDialog(user, FIRST.title)

      // 대화상자를 연 뒤 목록이 바뀐다: 같은 2쪽이지만 대상이 없는 1건짜리 목록
      serverPages = { 1: [makeItem(SECOND)], 2: [makeItem(THIRD)] }
      changeUrl('/manage?page=2&draft=true')
      await screen.findByText(THIRD.title)
      const callsBeforeConfirm = mockedFetchPostList.mock.calls.length

      await confirmDelete(user, dialog)

      await waitFor(() => expect(mockedFetchPostList.mock.calls.length).toBeGreaterThan(callsBeforeConfirm))
      await waitForDialogClosed()
      expect(mockedDelete).toHaveBeenCalledWith('PROJECT', FIRST.slug)
      expect(fetchPages().slice(callsBeforeConfirm)).toEqual([2])
    })
  })

  describe('경계', () => {
    it('취소를 누르면 대화상자가 닫히고 요청과 추가 조회 없이 목록이 그대로여야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      const dialog = await openDeleteDialog(user, FIRST.title)

      await user.click(within(dialog).getByRole('button', { name: '취소' }))

      await waitForDialogClosed()
      expect(mockedDelete).not.toHaveBeenCalled()
      expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls)
      expect(screen.getByText(FIRST.title)).toBeInTheDocument()
      expect(screen.getByText(SECOND.title)).toBeInTheDocument()
    })

    it('Esc로 대화상자를 닫아도 취소와 같이 요청 없이 목록이 그대로여야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      await openDeleteDialog(user, FIRST.title)

      await user.keyboard('{Escape}')

      await waitForDialogClosed()
      expect(mockedDelete).not.toHaveBeenCalled()
      expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls)
      expect(screen.getByText(FIRST.title)).toBeInTheDocument()
    })

    it('대화상자가 열려 있는 동안 배경의 행 버튼은 접근성 트리에서 숨겨져 찾히지 않아야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText(FIRST.title)
      await openDeleteDialog(user, FIRST.title)

      expect(screen.queryByRole('button', { name: '임시저장으로 전환' })).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(1)
      expect(screen.queryByRole('link', { name: '편집' })).not.toBeInTheDocument()
    })

    it('대화상자 삭제를 연달아 눌러도 deletePost는 한 번만 호출되고 요청이 끝나기 전에는 닫히지 않아야 한다', async () => {
      const user = userEvent.setup()
      const deferred = createDeferred()
      mockedDelete.mockReturnValue(deferred.promise)
      renderPage()
      await screen.findByText(FIRST.title)
      const dialog = await openDeleteDialog(user, FIRST.title)

      await confirmDelete(user, dialog)
      await user.click(within(dialog).getByRole('button', { name: DELETING_LABEL }))

      expect(mockedDelete).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      deferred.resolve()
      await waitForDialogClosed()
    })

    it('다른 글의 대화상자를 열었다 취소하고 다시 다른 글을 삭제하면 두 번째 글의 제목과 slug로 동작해야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText(FIRST.title)
      const firstDialog = await openDeleteDialog(user, FIRST.title)
      await user.click(within(firstDialog).getByRole('button', { name: '취소' }))
      await waitForDialogClosed()

      const secondDialog = await openDeleteDialog(user, SECOND.title)

      expect(within(secondDialog).getByText('「둘째 글」을 삭제할까요? 되돌릴 수 없습니다.')).toBeInTheDocument()

      await confirmDelete(user, secondDialog)

      expect(mockedDelete).toHaveBeenCalledTimes(1)
      expect(mockedDelete).toHaveBeenCalledWith('PROJECT', SECOND.slug)
    })

    it('1쪽의 마지막 글을 삭제하면 이전 페이지로 이동하지 않고 page 1로 다시 조회해야 한다', async () => {
      const user = userEvent.setup()
      serverPages = { 1: [makeItem(FIRST)] }
      renderPage('/manage?page=1')
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      const dialog = await openDeleteDialog(user, FIRST.title)
      serverPages = {}

      await confirmDelete(user, dialog)

      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      expect(fetchPages().slice(initialCalls)).toEqual([1])
    })

    it('삭제 실패 뒤 표의 행들은 그대로 있고 재조회는 일어나지 않아야 한다', async () => {
      const user = userEvent.setup()
      mockedDelete.mockRejectedValue(new ApiError(500, 'x'))
      renderPage()
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      const dialog = await openDeleteDialog(user, FIRST.title)

      await confirmDelete(user, dialog)
      await screen.findByRole('alert')

      expect(screen.getByText(FIRST.title)).toBeInTheDocument()
      expect(screen.getByText(SECOND.title)).toBeInTheDocument()
      expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls)
    })

    it('삭제 실패 뒤 같은 글의 삭제를 다시 눌러 재시도하면 deletePost가 다시 호출돼야 한다', async () => {
      const user = userEvent.setup()
      mockedDelete.mockRejectedValueOnce(new ApiError(500, 'x'))
      renderPage()
      await screen.findByText(FIRST.title)
      const dialog = await openDeleteDialog(user, FIRST.title)
      await confirmDelete(user, dialog)
      await screen.findByRole('alert')

      const retryDialog = await openDeleteDialog(user, FIRST.title)
      await confirmDelete(user, retryDialog)

      expect(mockedDelete).toHaveBeenCalledTimes(2)
      expect(mockedDelete).toHaveBeenLastCalledWith('PROJECT', FIRST.slug)
    })

    it('삭제 요청이 진행되는 동안 그 행의 전환 버튼은 처리 중…/disabled이고 실패로 끝나면 복구돼야 한다', async () => {
      const user = userEvent.setup()
      const deferred = createDeferred()
      mockedDelete.mockReturnValue(deferred.promise)
      renderPage()
      await screen.findByText(FIRST.title)
      const dialog = await openDeleteDialog(user, FIRST.title)

      await confirmDelete(user, dialog)

      // 대화상자 뒤의 배경은 aria-hidden이므로 hidden 옵션으로 조회한다
      expect(within(rowOf(FIRST.title)).getByRole('button', { name: PENDING_LABEL, hidden: true })).toBeDisabled()

      deferred.reject(new ApiError(500, 'x'))
      await screen.findByRole('alert')

      expect(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' })).toBeEnabled()
      expect(within(rowOf(FIRST.title)).getByRole('button', { name: '삭제' })).toBeEnabled()
    })

    it('한 글의 전환 요청이 진행 중이면 그 행의 삭제 버튼은 disabled라 대화상자가 열리지 않고 다른 글의 삭제는 열려야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdate.mockReturnValue(createDeferred().promise)
      renderPage()
      await screen.findByText(FIRST.title)
      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' }))

      const firstDelete = within(rowOf(FIRST.title)).getByRole('button', { name: '삭제' })

      expect(firstDelete).toBeDisabled()

      await user.click(firstDelete)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      const dialog = await openDeleteDialog(user, SECOND.title)

      expect(within(dialog).getByText('「둘째 글」을 삭제할까요? 되돌릴 수 없습니다.')).toBeInTheDocument()
    })
  })

  describe('예외', () => {
    it('서버 오류(500)이면 대화상자가 닫히고 표 위에 text-destructive alert 문구가 보이며 행이 그대로이고 삭제 버튼이 다시 활성화돼야 한다', async () => {
      const user = userEvent.setup()
      mockedDelete.mockRejectedValue(new ApiError(500, 'x'))
      renderPage()
      await screen.findByText(FIRST.title)
      const dialog = await openDeleteDialog(user, FIRST.title)

      await confirmDelete(user, dialog)

      const alert = await screen.findByRole('alert')

      expect(alert).toHaveTextContent('삭제하지 못했습니다. (500)')
      expect(alert).toHaveClass('text-destructive')
      expect(alert.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      await waitForDialogClosed()
      expect(screen.getByText(FIRST.title)).toBeInTheDocument()
      expect(within(rowOf(FIRST.title)).getByRole('button', { name: '삭제' })).toBeEnabled()
    })

    it('네트워크 오류이면 같은 위치에 네트워크 문구가 보이고 대화상자가 닫혀야 한다', async () => {
      const user = userEvent.setup()
      mockedDelete.mockRejectedValue(new TypeError('network'))
      renderPage()
      await screen.findByText(FIRST.title)
      const dialog = await openDeleteDialog(user, FIRST.title)

      await confirmDelete(user, dialog)

      expect(await screen.findByRole('alert')).toHaveTextContent('네트워크 오류로 삭제하지 못했습니다.')
      await waitForDialogClosed()
    })

    it('400이면 삭제하지 못했습니다. (400)가 보이고 글이 남아 있어야 한다', async () => {
      const user = userEvent.setup()
      mockedDelete.mockRejectedValue(new ApiError(400, 'x'))
      renderPage()
      await screen.findByText(FIRST.title)
      const dialog = await openDeleteDialog(user, FIRST.title)

      await confirmDelete(user, dialog)

      expect(await screen.findByRole('alert')).toHaveTextContent('삭제하지 못했습니다. (400)')
      expect(screen.getByText(FIRST.title)).toBeInTheDocument()
    })

    it('404이면 대화상자가 닫히고 이미 삭제된 글입니다가 보이며 재조회로 그 글이 사라지고 안내가 남아야 한다', async () => {
      const user = userEvent.setup()
      mockedDelete.mockRejectedValue(new ApiError(404, 'x'))
      renderPage()
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      const dialog = await openDeleteDialog(user, FIRST.title)
      serverPages = { 1: [makeItem(SECOND)] }

      await confirmDelete(user, dialog)

      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      await waitForDialogClosed()
      await waitFor(() => expect(screen.queryByText(FIRST.title)).not.toBeInTheDocument())
      expect(screen.getByText(SECOND.title)).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('이미 삭제된 글입니다')
    })

    it('2쪽의 마지막 글이 404여도 이전 페이지(page - 1)로 이동해 갱신해야 한다', async () => {
      const user = userEvent.setup()
      mockedDelete.mockRejectedValue(new ApiError(404, 'x'))
      serverPages = { 1: [makeItem(SECOND)], 2: [makeItem(FIRST)] }
      renderPage('/manage?page=2')
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      const dialog = await openDeleteDialog(user, FIRST.title)
      serverPages = { 1: [makeItem(SECOND)] }

      await confirmDelete(user, dialog)

      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      expect(fetchPages().slice(initialCalls)).toEqual([1])
      expect(await screen.findByText(SECOND.title)).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('이미 삭제된 글입니다')
    })
  })
})
