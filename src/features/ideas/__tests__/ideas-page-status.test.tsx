import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api-client'
import { fetchIdeas, updateIdea } from '../ideas-api'
import type { IdeaListResponse, SavedIdea } from '../ideas-api'
import { IdeasPage } from '../ideas-page'

vi.mock('../ideas-api', () => ({ fetchIdeas: vi.fn(), updateIdea: vi.fn() }))

const mockedFetchIdeas = vi.mocked(fetchIdeas)
const mockedUpdateIdea = vi.mocked(updateIdea)

const TODO_IDEA: SavedIdea = {
  id: 'idea-todo',
  title: '대기 중인 글감',
  memo: '- 대기 메모',
  type: 'DEV_LOG',
  status: 'todo',
  createdAt: '2026-10-17T00:00:00.000Z',
}

const DOING_IDEA: SavedIdea = {
  id: 'idea-doing',
  title: '진행 중인 글감',
  memo: '- 진행 메모',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

/** 서버 저장소를 흉내 내는 글감 목록. updateIdea가 상태를 바꾸고 fetchIdeas가 그것을 돌려준다. */
let storedIdeas: SavedIdea[] = []

/** 테스트가 끝나는 시점을 쥐는 지연된 요청 */
function createDeferred() {
  let resolve!: (idea: SavedIdea) => void
  const promise = new Promise<SavedIdea>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

function renderPage(initialEntry = '/ideas') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <IdeasPage />
    </MemoryRouter>,
  )
}

function rowOf(title: string) {
  return screen.getByRole('row', { name: new RegExp(title) })
}

beforeEach(() => {
  storedIdeas = [{ ...DOING_IDEA }, { ...TODO_IDEA }]
  mockedFetchIdeas.mockReset()
  mockedUpdateIdea.mockReset()

  mockedFetchIdeas.mockImplementation(
    async (status): Promise<IdeaListResponse> => ({
      data: storedIdeas.filter((idea) => !status || idea.status === status),
    }),
  )
  mockedUpdateIdea.mockImplementation(async (id, input) => {
    storedIdeas = storedIdeas.map((idea) => (idea.id === id ? { ...idea, ...input } : idea))

    return storedIdeas.find((idea) => idea.id === id) as SavedIdea
  })
})

describe('IdeasPage 상태 변경', () => {
  describe('정상', () => {
    it("행의 '진행' 버튼을 누르면 updateIdea가 (id, { status: 'doing' })로 호출되고 성공 뒤 목록을 다시 조회해 바뀐 상태가 보여야 한다", async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('대기 중인 글감')

      await user.click(within(rowOf('대기 중인 글감')).getByRole('button', { name: '진행' }))

      expect(mockedUpdateIdea).toHaveBeenCalledTimes(1)
      expect(mockedUpdateIdea).toHaveBeenCalledWith('idea-todo', { status: 'doing' })
      await waitFor(() =>
        expect(within(rowOf('대기 중인 글감')).getByRole('button', { name: '진행' })).toHaveAttribute('aria-pressed', 'true'),
      )
      expect(mockedFetchIdeas).toHaveBeenCalledTimes(2)
    })
  })

  describe('경계', () => {
    it("진행 탭을 보고 있을 때 글감을 '완료'로 바꾸면 재조회 결과에서 그 글감이 빠져야 한다", async () => {
      const user = userEvent.setup()
      renderPage('/ideas?status=doing')
      await screen.findByText('진행 중인 글감')

      await user.click(within(rowOf('진행 중인 글감')).getByRole('button', { name: '완료' }))

      await waitFor(() => expect(screen.queryByText('진행 중인 글감')).not.toBeInTheDocument())
      expect(mockedFetchIdeas.mock.calls.at(-1)?.[0]).toBe('doing')
    })

    it('같은 글감을 연달아 눌러도 요청은 한 번만 가야 한다', async () => {
      const user = userEvent.setup()
      const deferred = createDeferred()
      mockedUpdateIdea.mockReturnValue(deferred.promise)
      renderPage()
      await screen.findByText('대기 중인 글감')
      const row = rowOf('대기 중인 글감')

      await user.click(within(row).getByRole('button', { name: '진행' }))
      await user.click(within(row).getByRole('button', { name: '완료' }))

      expect(mockedUpdateIdea).toHaveBeenCalledTimes(1)

      deferred.resolve({ ...TODO_IDEA, status: 'doing' })
    })
  })

  describe('예외', () => {
    it('상태 변경이 실패하면 표 위에 role="alert" 오류 문구가 보이고 목록의 기존 상태가 유지돼야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdateIdea.mockRejectedValue(new ApiError(500, '실패'))
      renderPage()
      await screen.findByText('대기 중인 글감')

      await user.click(within(rowOf('대기 중인 글감')).getByRole('button', { name: '진행' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('상태를 바꾸지 못했습니다. (500)')
      expect(within(rowOf('대기 중인 글감')).getByRole('button', { name: '대기' })).toHaveAttribute('aria-pressed', 'true')
      expect(mockedFetchIdeas).toHaveBeenCalledTimes(1)
    })

    it("404이면 '이미 삭제된 글감입니다'가 보이고 목록이 다시 조회돼야 한다", async () => {
      const user = userEvent.setup()
      mockedUpdateIdea.mockRejectedValue(new ApiError(404, '없음'))
      renderPage()
      await screen.findByText('대기 중인 글감')

      await user.click(within(rowOf('대기 중인 글감')).getByRole('button', { name: '진행' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('이미 삭제된 글감입니다')
      await waitFor(() => expect(mockedFetchIdeas).toHaveBeenCalledTimes(2))
    })
  })
})
