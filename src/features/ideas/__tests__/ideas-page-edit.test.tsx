import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api-client'
import { createIdea, fetchIdeas, updateIdea } from '../ideas-api'
import type { IdeaListResponse, SavedIdea } from '../ideas-api'
import { IdeasPage } from '../ideas-page'

vi.mock('../ideas-api', () => ({ fetchIdeas: vi.fn(), createIdea: vi.fn(), updateIdea: vi.fn() }))

const mockedFetchIdeas = vi.mocked(fetchIdeas)
const mockedCreateIdea = vi.mocked(createIdea)
const mockedUpdateIdea = vi.mocked(updateIdea)

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

/** 서버 저장소를 흉내 내는 글감 목록. createIdea·updateIdea가 바꾸고 fetchIdeas가 그것을 돌려준다. */
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

/** 빠른 추가의 제목 입력창. 수정 다이얼로그가 열려 있으면 그 안의 입력창과 구분해 페이지 쪽만 고른다. */
function quickAddInput() {
  return screen.getAllByPlaceholderText('제목')[0]
}

async function openEditDialogFor(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByText(title))
  const detail = await screen.findByRole('dialog')
  await user.click(within(detail).getByRole('button', { name: '수정' }))
  const edit = await screen.findByRole('dialog')
  await within(edit).findByRole('button', { name: '저장' })

  return edit
}

async function replaceText(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, text: string) {
  await user.clear(input)
  await user.type(input, text)
}

beforeEach(() => {
  storedIdeas = [{ ...DOING_IDEA }, { ...TODO_IDEA }]
  mockedFetchIdeas.mockReset()
  mockedCreateIdea.mockReset()
  mockedUpdateIdea.mockReset()

  mockedFetchIdeas.mockImplementation(
    async (status): Promise<IdeaListResponse> => ({
      data: storedIdeas.filter((idea) => !status || idea.status === status),
    }),
  )
  mockedCreateIdea.mockImplementation(async ({ title, memo, type }) => {
    const created: SavedIdea = {
      id: `idea-new-${storedIdeas.length}`,
      title,
      memo,
      type,
      status: 'todo',
      createdAt: '2026-10-20T00:00:00.000Z',
    }
    storedIdeas = [created, ...storedIdeas]

    return created
  })
  mockedUpdateIdea.mockImplementation(async (id, input) => {
    storedIdeas = storedIdeas.map((idea) => (idea.id === id ? { ...idea, ...input } : idea))

    return storedIdeas.find((idea) => idea.id === id) as SavedIdea
  })
})

describe('IdeasPage 빠른 추가', () => {
  describe('정상', () => {
    it('제목을 입력하고 추가하면 createIdea가 { title, memo: "", type }으로 호출되고 성공 뒤 목록을 다시 조회해 새 글감이 대기 상태로 보이며 입력창이 비워져야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('대기 중인 글감')

      await user.type(quickAddInput(), '직접 추가한 글감')
      await user.click(screen.getByRole('button', { name: '추가' }))

      expect(mockedCreateIdea).toHaveBeenCalledTimes(1)
      expect(mockedCreateIdea).toHaveBeenCalledWith({ title: '직접 추가한 글감', memo: '', type: 'DEV_LOG' })
      const row = await screen.findByRole('row', { name: /직접 추가한 글감/ })
      expect(within(row).getByRole('button', { name: '대기' })).toHaveAttribute('aria-pressed', 'true')
      expect(quickAddInput()).toHaveValue('')
      expect(mockedFetchIdeas).toHaveBeenCalledTimes(2)
    })
  })

  describe('경계', () => {
    it('제목이 공백뿐이면 추가할 수 없고 createIdea가 호출되지 않아야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('대기 중인 글감')

      await user.type(quickAddInput(), '   ')

      expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
      await user.keyboard('{Enter}')
      expect(mockedCreateIdea).not.toHaveBeenCalled()
    })

    it('진행 탭을 보는 중 빠른 추가를 하면 목록은 그 탭 기준으로 다시 조회돼야 한다', async () => {
      const user = userEvent.setup()
      renderPage('/ideas?status=doing')
      await screen.findByText('진행 중인 글감')

      await user.type(quickAddInput(), '탭 중에 추가')
      await user.click(screen.getByRole('button', { name: '추가' }))

      await waitFor(() => expect(mockedFetchIdeas).toHaveBeenCalledTimes(2))
      expect(mockedFetchIdeas.mock.calls.at(-1)?.[0]).toBe('doing')
    })
  })

  describe('예외', () => {
    it('추가가 실패하면 입력한 제목이 남고 빠른 추가 아래에 오류 문구가 보여 다시 추가할 수 있어야 한다', async () => {
      const user = userEvent.setup()
      mockedCreateIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      renderPage()
      await screen.findByText('대기 중인 글감')

      await user.type(quickAddInput(), '실패했다 다시 추가')
      await user.click(screen.getByRole('button', { name: '추가' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('서버 오류로 저장하지 못했어요. 잠시 후 다시 시도해 주세요. (500)')
      expect(quickAddInput()).toHaveValue('실패했다 다시 추가')

      await user.click(screen.getByRole('button', { name: '추가' }))

      expect(await screen.findByRole('row', { name: /실패했다 다시 추가/ })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})

describe('IdeasPage 수정', () => {
  describe('정상', () => {
    it('상세 모달의 "수정"을 누르면 상세가 닫히고 현재 값이 채워진 수정 다이얼로그가 열려야 한다', async () => {
      const user = userEvent.setup()
      renderPage()

      const edit = await openEditDialogFor(user, '진행 중인 글감')

      expect(within(edit).getByPlaceholderText('제목')).toHaveValue('진행 중인 글감')
      expect(within(edit).getByPlaceholderText('메모')).toHaveValue('- 진행 메모')
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      expect(within(edit).queryByText('글감 상세')).not.toBeInTheDocument()
    })

    it('수정을 저장하면 updateIdea(id, { title, memo, type })이 호출되고, 성공 뒤 목록이 다시 조회돼 바뀐 제목이 보이며 상세 모달이 바뀐 내용으로 다시 열려야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      const edit = await openEditDialogFor(user, '진행 중인 글감')

      await replaceText(user, within(edit).getByPlaceholderText('제목'), '새로 고친 제목')
      await user.click(within(edit).getByRole('button', { name: '저장' }))

      expect(mockedUpdateIdea).toHaveBeenCalledTimes(1)
      expect(mockedUpdateIdea).toHaveBeenCalledWith('idea-doing', { title: '새로 고친 제목', memo: '- 진행 메모', type: 'LAB' })
      const detail = await screen.findByRole('dialog')
      expect(within(detail).getByText('새로 고친 제목')).toBeInTheDocument()
      expect(within(detail).getByRole('button', { name: '수정' })).toBeInTheDocument()
      // 상세 모달이 열려 있는 동안 배경(목록)은 aria-hidden이라 hidden 쿼리로 찾는다
      expect(screen.getByRole('row', { name: /새로 고친 제목/, hidden: true })).toBeInTheDocument()
      expect(mockedFetchIdeas).toHaveBeenCalledTimes(2)
    })

    it('수정 다이얼로그에서 취소하면 상세 모달로 돌아가 수정 전 내용이 보여야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      const edit = await openEditDialogFor(user, '진행 중인 글감')

      await replaceText(user, within(edit).getByPlaceholderText('제목'), '저장하지 않을 제목')
      await user.click(within(edit).getByRole('button', { name: '취소' }))

      const detail = await screen.findByRole('dialog')
      expect(within(detail).getByText('진행 중인 글감')).toBeInTheDocument()
      expect(within(detail).getByRole('button', { name: '수정' })).toBeInTheDocument()
      expect(mockedUpdateIdea).not.toHaveBeenCalled()
    })
  })

  describe('경계', () => {
    it('수정 저장이 진행되는 동안 저장 버튼이 비활성이라 한 번만 요청이 가야 한다', async () => {
      const user = userEvent.setup()
      const deferred = createDeferred()
      mockedUpdateIdea.mockReturnValue(deferred.promise)
      renderPage()
      const edit = await openEditDialogFor(user, '진행 중인 글감')

      await user.click(within(edit).getByRole('button', { name: '저장' }))
      const savingButton = await within(edit).findByRole('button', { name: '저장 중…' })
      await user.click(savingButton)

      expect(savingButton).toBeDisabled()
      expect(mockedUpdateIdea).toHaveBeenCalledTimes(1)

      deferred.resolve({ ...DOING_IDEA })
    })
  })

  describe('예외', () => {
    it('수정 저장이 실패하면 수정 다이얼로그 안에 오류 문구가 보이고 입력이 유지되며 다시 저장해 성공할 수 있어야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdateIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      renderPage()
      const edit = await openEditDialogFor(user, '진행 중인 글감')
      await replaceText(user, within(edit).getByPlaceholderText('제목'), '다시 저장할 제목')

      await user.click(within(edit).getByRole('button', { name: '저장' }))

      expect(await within(edit).findByRole('alert')).toHaveTextContent(
        '서버 오류로 저장하지 못했어요. 잠시 후 다시 시도해 주세요. (500)',
      )
      expect(within(edit).getByPlaceholderText('제목')).toHaveValue('다시 저장할 제목')

      await user.click(within(edit).getByRole('button', { name: '저장' }))

      const detail = await screen.findByRole('dialog')
      expect(within(detail).getByText('다시 저장할 제목')).toBeInTheDocument()
      expect(mockedUpdateIdea).toHaveBeenCalledTimes(2)
    })

    it('수정 저장이 404이면 "이미 삭제된 글감입니다"가 다이얼로그 안에 보여야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdateIdea.mockRejectedValueOnce(new ApiError(404, '없음'))
      renderPage()
      const edit = await openEditDialogFor(user, '진행 중인 글감')

      await user.click(within(edit).getByRole('button', { name: '저장' }))

      expect(await within(edit).findByRole('alert')).toHaveTextContent('이미 삭제된 글감입니다')
    })

    it('수정 저장 중 오류가 난 뒤 취소하고 다른 글감을 수정하려 열면 이전 오류 문구가 남아 있지 않아야 한다', async () => {
      const user = userEvent.setup()
      mockedUpdateIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      renderPage()
      const first = await openEditDialogFor(user, '진행 중인 글감')
      await user.click(within(first).getByRole('button', { name: '저장' }))
      await within(first).findByRole('alert')
      await user.click(within(first).getByRole('button', { name: '취소' }))
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      const second = await openEditDialogFor(user, '대기 중인 글감')

      expect(within(second).getByPlaceholderText('제목')).toHaveValue('대기 중인 글감')
      expect(within(second).queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
