import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api-client'
import { deleteIdea, fetchIdeas, updateIdea } from '../ideas-api'
import type { IdeaListResponse, SavedIdea } from '../ideas-api'
import { IdeasPage } from '../ideas-page'

vi.mock('../ideas-api', () => ({ fetchIdeas: vi.fn(), updateIdea: vi.fn(), deleteIdea: vi.fn() }))

const mockedFetchIdeas = vi.mocked(fetchIdeas)
const mockedUpdateIdea = vi.mocked(updateIdea)
const mockedDeleteIdea = vi.mocked(deleteIdea)

const DOING_IDEA: SavedIdea = {
  id: 'idea-doing',
  title: '진행 중인 글감',
  memo: '- 진행 메모',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

const TODO_IDEA: SavedIdea = {
  id: 'idea-todo',
  title: '대기 중인 글감',
  memo: '- 대기 메모',
  type: 'DEV_LOG',
  status: 'todo',
  createdAt: '2026-10-17T00:00:00.000Z',
}

/** 서버 저장소를 흉내 내는 글감 목록. deleteIdea·updateIdea가 바꾸고 fetchIdeas가 그것을 돌려준다. */
let storedIdeas: SavedIdea[] = []

/** 테스트가 끝나는 시점을 쥐는 지연된 요청 */
function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

type User = ReturnType<typeof userEvent.setup>

function renderPage(initialEntry = '/ideas') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <IdeasPage />
    </MemoryRouter>,
  )
}

async function openConfirmFor(user: User, title: string) {
  await user.click(await screen.findByText(title))
  const detail = await screen.findByRole('dialog')
  await user.click(within(detail).getByRole('button', { name: '삭제' }))

  return screen.findByRole('dialog', { name: '글감 삭제' })
}

beforeEach(() => {
  storedIdeas = [{ ...DOING_IDEA }, { ...TODO_IDEA }]
  mockedFetchIdeas.mockReset()
  mockedUpdateIdea.mockReset()
  mockedDeleteIdea.mockReset()

  mockedFetchIdeas.mockImplementation(
    async (status): Promise<IdeaListResponse> => ({
      data: storedIdeas.filter((idea) => !status || idea.status === status),
    }),
  )
  mockedUpdateIdea.mockImplementation(async (id, input) => {
    storedIdeas = storedIdeas.map((idea) => (idea.id === id ? { ...idea, ...input } : idea))

    return storedIdeas.find((idea) => idea.id === id) as SavedIdea
  })
  mockedDeleteIdea.mockImplementation(async (id) => {
    storedIdeas = storedIdeas.filter((idea) => idea.id !== id)
  })
})

describe('IdeasPage 삭제', () => {
  describe('정상', () => {
    it('상세 모달의 "삭제"를 누르면 상세가 닫히고 "글감 삭제" 확인 대화상자가 그 글감의 제목과 함께 열려야 한다', async () => {
      const user = userEvent.setup()
      renderPage()

      const confirm = await openConfirmFor(user, '진행 중인 글감')

      expect(within(confirm).getByText('「진행 중인 글감」을 삭제할까요? 되돌릴 수 없습니다.')).toBeInTheDocument()
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })

    it('삭제를 확정하면 deleteIdea(id)가 한 번 호출되고, 성공 뒤 대화상자가 닫히며 목록이 다시 조회돼 그 글감이 사라져야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      const confirm = await openConfirmFor(user, '진행 중인 글감')

      await user.click(within(confirm).getByRole('button', { name: '삭제' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(mockedDeleteIdea).toHaveBeenCalledTimes(1)
      expect(mockedDeleteIdea).toHaveBeenCalledWith('idea-doing')
      expect(screen.queryByText('진행 중인 글감')).not.toBeInTheDocument()
      expect(screen.getByText('대기 중인 글감')).toBeInTheDocument()
      expect(mockedFetchIdeas).toHaveBeenCalledTimes(2)
    })

    it('확인 대화상자에서 취소하면 deleteIdea가 호출되지 않고 상세 모달로 돌아가 같은 글감이 보여야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      const confirm = await openConfirmFor(user, '진행 중인 글감')

      await user.click(within(confirm).getByRole('button', { name: '취소' }))

      const detail = await screen.findByRole('dialog', { name: '진행 중인 글감' })
      expect(within(detail).getByRole('button', { name: '삭제' })).toBeInTheDocument()
      expect(mockedDeleteIdea).not.toHaveBeenCalled()
    })

    it('삭제 요청이 진행되는 동안 대화상자 안에 로딩 스피너가 보이고, 요청이 끝나 대화상자가 닫히면 스피너도 사라져야 한다', async () => {
      const user = userEvent.setup()
      const deferred = createDeferred()
      mockedDeleteIdea.mockReturnValue(deferred.promise)
      renderPage()
      const confirm = await openConfirmFor(user, '진행 중인 글감')
      expect(within(confirm).queryByRole('status')).not.toBeInTheDocument()

      await user.click(within(confirm).getByRole('button', { name: '삭제' }))

      expect(await within(confirm).findByRole('status', { name: '삭제 중' })).toBeInTheDocument()

      deferred.resolve()

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.queryByRole('status', { name: '삭제 중' })).not.toBeInTheDocument()
    })
  })

  describe('경계', () => {
    it('진행 탭을 보는 중 삭제하면 목록은 같은 status로 다시 조회돼야 한다', async () => {
      const user = userEvent.setup()
      renderPage('/ideas?status=doing')
      const confirm = await openConfirmFor(user, '진행 중인 글감')

      await user.click(within(confirm).getByRole('button', { name: '삭제' }))

      await waitFor(() => expect(mockedFetchIdeas).toHaveBeenCalledTimes(2))
      expect(mockedFetchIdeas.mock.calls.at(-1)?.[0]).toBe('doing')
    })

    it('삭제 요청이 진행되는 동안 대화상자의 버튼이 "삭제 중…"으로 비활성이고 Esc로 닫히지 않으며 요청은 한 번만 가야 한다', async () => {
      const user = userEvent.setup()
      const deferred = createDeferred()
      mockedDeleteIdea.mockReturnValue(deferred.promise)
      renderPage()
      const confirm = await openConfirmFor(user, '진행 중인 글감')

      await user.click(within(confirm).getByRole('button', { name: '삭제' }))
      const pendingButton = await within(confirm).findByRole('button', { name: '삭제 중…' })
      await user.click(pendingButton)
      await user.keyboard('{Escape}')

      expect(pendingButton).toBeDisabled()
      expect(within(confirm).getByRole('button', { name: '취소' })).toBeDisabled()
      expect(screen.getByRole('dialog', { name: '글감 삭제' })).toBeInTheDocument()
      expect(mockedDeleteIdea).toHaveBeenCalledTimes(1)

      deferred.resolve()
    })
  })

  describe('예외', () => {
    it('404이면 "이미 삭제된 글감입니다"가 표 위에 보이고 대화상자가 닫히며 목록이 다시 조회돼야 한다', async () => {
      const user = userEvent.setup()
      mockedDeleteIdea.mockRejectedValueOnce(new ApiError(404, '없음'))
      renderPage()
      const confirm = await openConfirmFor(user, '진행 중인 글감')

      await user.click(within(confirm).getByRole('button', { name: '삭제' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('이미 삭제된 글감입니다')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(mockedFetchIdeas).toHaveBeenCalledTimes(2)
    })

    it('500이면 대화상자가 닫히고 표 위에 "삭제하지 못했습니다. (500)"이 보이며 글감은 목록에 그대로 있어야 한다', async () => {
      const user = userEvent.setup()
      mockedDeleteIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      renderPage()
      const confirm = await openConfirmFor(user, '진행 중인 글감')

      await user.click(within(confirm).getByRole('button', { name: '삭제' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('삭제하지 못했습니다. (500)')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getByText('진행 중인 글감')).toBeInTheDocument()
      expect(mockedFetchIdeas).toHaveBeenCalledTimes(1)
    })

    it('삭제 실패 뒤 다음 요청(상태 변경)을 시작하면 이전 오류 문구가 지워져야 한다', async () => {
      const user = userEvent.setup()
      mockedDeleteIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      renderPage()
      const confirm = await openConfirmFor(user, '진행 중인 글감')
      await user.click(within(confirm).getByRole('button', { name: '삭제' }))
      await screen.findByRole('alert')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      const row = screen.getByRole('row', { name: /대기 중인 글감/ })
      await user.click(within(row).getByRole('button', { name: '진행' }))

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(mockedUpdateIdea).toHaveBeenCalledWith('idea-todo', { status: 'doing' })
    })
  })
})
