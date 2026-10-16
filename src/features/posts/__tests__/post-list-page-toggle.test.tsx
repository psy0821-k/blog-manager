import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api-client'
import { fetchCategories } from '../../categories/categories-api'
import { PostListPage } from '../post-list-page'
import type { PostListItem, PostListResponse } from '../post-types'
import { fetchPostList, updatePostPublished } from '../posts-api'

vi.mock('@/lib/env', () => ({ BLOG_API_URL: '', BLOG_LOGIN_URL: 'https://blog.example/admin-login' }))
vi.mock('../posts-api', () => ({ fetchPostList: vi.fn(), updatePostPublished: vi.fn() }))
vi.mock('../../categories/categories-api', () => ({ fetchCategories: vi.fn() }))

const mockedFetchPostList = vi.mocked(fetchPostList)
const mockedUpdate = vi.mocked(updatePostPublished)
const mockedFetchCategories = vi.mocked(fetchCategories)

const PENDING_LABEL = '처리 중…'
const FIRST = { slug: 'first-slug', title: '첫 글' }
const SECOND = { slug: 'second-slug', title: '둘째 글' }

function makeItem({ slug, title }: { slug: string; title: string }): PostListItem {
  const date = '2026-10-08T12:00:00Z'
  return { id: slug, title, slug, viewCount: 0, createdAt: date, updatedAt: date }
}

function makeResponse(data: PostListItem[]): PostListResponse {
  return { data, meta: { page: 1, pageSize: 30, totalCount: data.length, totalPages: 1 } }
}

/** 서버가 가진 목록을 흉내 낸다. 테스트가 배열을 바꾸면 이후 조회에 반영된다. */
let serverPosts: PostListItem[]

function renderPage(entry = '/manage') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PostListPage />
    </MemoryRouter>,
  )
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

beforeEach(() => {
  mockedFetchPostList.mockReset()
  mockedUpdate.mockReset()
  mockedFetchCategories.mockReset()
  mockedFetchCategories.mockResolvedValue([])
  mockedUpdate.mockResolvedValue(undefined)
  serverPosts = [makeItem(FIRST), makeItem(SECOND)]
  mockedFetchPostList.mockImplementation(async () => makeResponse(serverPosts))
})

describe('PostListPage 발행 전환', () => {
  describe('정상', () => {
    it('발행됨 보기의 각 행에 임시저장으로 전환 버튼이 있고 누르면 published: false로 호출해야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText(FIRST.title)

      expect(screen.getAllByRole('button', { name: '임시저장으로 전환' })).toHaveLength(2)

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' }))

      expect(mockedUpdate).toHaveBeenCalledWith('PROJECT', FIRST.slug, false)
    })

    it('임시저장 보기의 각 행에 발행 버튼이 있고 누르면 published: true로 호출해야 한다', async () => {
      const user = userEvent.setup()
      renderPage('/manage?draft=true')
      await screen.findByText(FIRST.title)

      expect(mockedFetchPostList.mock.calls[0][0]).toMatchObject({ draft: true })
      expect(screen.getAllByRole('button', { name: '발행' })).toHaveLength(2)

      await user.click(within(rowOf(SECOND.title)).getByRole('button', { name: '발행' }))

      expect(mockedUpdate).toHaveBeenCalledWith('PROJECT', SECOND.slug, true)
    })

    it('전환을 누른 행의 버튼이 요청 중 처리 중…/disabled가 되고 성공하면 재조회로 그 글이 목록에서 사라져야 한다', async () => {
      const user = userEvent.setup()
      const deferred = createDeferred()
      mockedUpdate.mockReturnValue(deferred.promise)
      renderPage('/manage?draft=true')
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '발행' }))

      expect(within(rowOf(FIRST.title)).getByRole('button', { name: PENDING_LABEL })).toBeDisabled()

      serverPosts = [makeItem(SECOND)]
      deferred.resolve()

      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      await waitFor(() => expect(screen.queryByText(FIRST.title)).not.toBeInTheDocument())
      expect(screen.getByText(SECOND.title)).toBeInTheDocument()
    })

    it('재조회는 현재 보기, 페이지, 검색, 카테고리 그대로 해야 한다', async () => {
      const user = userEvent.setup()
      renderPage('/manage?page=2&q=abc&category=react&draft=true')
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '발행' }))

      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      expect(mockedFetchPostList.mock.calls[initialCalls][0]).toEqual({
        type: 'PROJECT',
        page: 2,
        q: 'abc',
        category: 'react',
        draft: true,
      })
    })

    it('랩 탭에서 전환하면 LAB 종류로 호출하고 같은 방식으로 목록이 갱신돼야 한다', async () => {
      const user = userEvent.setup()
      renderPage('/manage?type=LAB')
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' }))

      expect(mockedUpdate).toHaveBeenCalledWith('LAB', FIRST.slug, false)
      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      expect(mockedFetchPostList.mock.calls[initialCalls][0]).toMatchObject({ type: 'LAB' })
    })
  })

  describe('경계', () => {
    it('처리 중인 행의 버튼은 다시 눌러도 요청이 한 번뿐이고 다른 글의 버튼은 활성이어서 누르면 두 번째 요청이 가야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdate.mockReturnValue(createDeferred().promise)
      renderPage()
      await screen.findByText(FIRST.title)

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' }))
      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: PENDING_LABEL }))

      expect(mockedUpdate).toHaveBeenCalledTimes(1)

      await user.click(within(rowOf(SECOND.title)).getByRole('button', { name: '임시저장으로 전환' }))

      expect(mockedUpdate).toHaveBeenCalledTimes(2)
      expect(mockedUpdate).toHaveBeenLastCalledWith('PROJECT', SECOND.slug, false)
    })

    it('처리 중에는 해당 행만 처리 중…이고 다른 행의 버튼 문구는 그대로여야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdate.mockReturnValue(createDeferred().promise)
      renderPage()
      await screen.findByText(FIRST.title)

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' }))

      expect(within(rowOf(FIRST.title)).getByRole('button', { name: PENDING_LABEL })).toBeDisabled()
      expect(within(rowOf(SECOND.title)).getByRole('button', { name: '임시저장으로 전환' })).toBeEnabled()
    })

    it('전환 오류 후에도 표의 행들은 그대로 있고 재조회는 일어나지 않아야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdate.mockRejectedValue(new ApiError(500, 'x'))
      renderPage()
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' }))
      await screen.findByRole('alert')

      expect(screen.getByText(FIRST.title)).toBeInTheDocument()
      expect(screen.getByText(SECOND.title)).toBeInTheDocument()
      expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls)
    })
  })

  describe('예외', () => {
    it('서버 오류(500)이면 표 위에 text-destructive alert 문구가 보이고 버튼이 다시 활성화돼야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdate.mockRejectedValue(new ApiError(500, 'x'))
      renderPage()
      await screen.findByText(FIRST.title)

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' }))

      const alert = await screen.findByRole('alert')

      expect(alert).toHaveTextContent('상태를 바꾸지 못했습니다. (500)')
      expect(alert).toHaveClass('text-destructive')
      expect(alert.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' })).toBeEnabled()
    })

    it('발행 전환이 서버 오류(500)여도 임시저장 보기에서 발행 문구로 돌아와야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdate.mockRejectedValue(new ApiError(500, 'x'))
      renderPage('/manage?draft=true')
      await screen.findByText(FIRST.title)

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '발행' }))
      await screen.findByRole('alert')

      expect(within(rowOf(FIRST.title)).getByRole('button', { name: '발행' })).toBeEnabled()
    })

    it('네트워크 오류이면 같은 위치에 네트워크 문구가 보이고 버튼이 다시 활성화돼야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdate.mockRejectedValue(new TypeError('network'))
      renderPage()
      await screen.findByText(FIRST.title)

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('네트워크 오류로 상태를 바꾸지 못했습니다.')
      expect(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' })).toBeEnabled()
    })

    it('404이면 이미 삭제된 글입니다가 보이고 재조회로 그 글이 사라지며 재조회가 끝난 뒤에도 안내가 남아야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdate.mockRejectedValue(new ApiError(404, 'x'))
      renderPage()
      await screen.findByText(FIRST.title)
      const initialCalls = mockedFetchPostList.mock.calls.length
      serverPosts = [makeItem(SECOND)]

      await user.click(within(rowOf(FIRST.title)).getByRole('button', { name: '임시저장으로 전환' }))

      await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(initialCalls + 1))
      await waitFor(() => expect(screen.queryByText(FIRST.title)).not.toBeInTheDocument())
      expect(screen.getByText(SECOND.title)).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('이미 삭제된 글입니다')
    })
  })
})
