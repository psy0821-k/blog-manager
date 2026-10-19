import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchIdeas } from '../ideas-api'
import type { IdeaListResponse, SavedIdea } from '../ideas-api'
import { IdeasPage } from '../ideas-page'

vi.mock('../ideas-api', () => ({ fetchIdeas: vi.fn() }))

const mockedFetchIdeas = vi.mocked(fetchIdeas)

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
  memo: '- 진행 메모 첫 줄\n- 진행 메모 둘째 줄',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

const ALL_IDEAS = [DOING_IDEA, TODO_IDEA]

/** 요청한 status로 거른 목록을 돌려주는 서버 흉내 */
function mockServerByStatus() {
  mockedFetchIdeas.mockImplementation(async (status): Promise<IdeaListResponse> => ({
    data: status ? ALL_IDEAS.filter((idea) => idea.status === status) : ALL_IDEAS,
  }))
}

/** 테스트가 끝나는 시점을 쥐는 지연된 요청 */
function createDeferred() {
  let resolve!: (response: IdeaListResponse) => void
  const promise = new Promise<IdeaListResponse>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

function LocationProbe() {
  const location = useLocation()

  return <div data-testid="location-search">{location.search}</div>
}

function renderPage(initialEntry = '/ideas') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <IdeasPage />
      <LocationProbe />
    </MemoryRouter>,
  )
}

function currentSearch() {
  return new URLSearchParams(screen.getByTestId('location-search').textContent ?? '')
}

function lastRequestedStatus() {
  return mockedFetchIdeas.mock.calls.at(-1)?.[0]
}

beforeEach(() => {
  mockedFetchIdeas.mockReset()
  mockServerByStatus()
})

describe('IdeasPage', () => {
  describe('정상', () => {
    it('열면 불러오는 중이 보이다가 글감 목록이 제목·종류·상태로 보여야 한다', async () => {
      renderPage()

      expect(screen.getByText('불러오는 중...')).toBeInTheDocument()

      const row = await screen.findByRole('row', { name: /진행 중인 글감/ })
      expect(within(row).getByText('랩')).toBeInTheDocument()
      expect(within(row).getByText('진행')).toBeInTheDocument()
      expect(screen.getByRole('row', { name: /대기 중인 글감/ })).toBeInTheDocument()
      expect(screen.queryByText('불러오는 중...')).not.toBeInTheDocument()
    })

    it('주소에 status가 없으면 전체 탭이 선택되고 status 없이 조회해야 한다', async () => {
      renderPage()

      await screen.findByText('대기 중인 글감')

      expect(screen.getByRole('tab', { name: '전체' })).toHaveAttribute('aria-selected', 'true')
      expect(lastRequestedStatus()).toBeUndefined()
    })

    it('탭은 전체, 대기, 진행, 완료 순서로 있어야 한다', async () => {
      renderPage()
      await screen.findByText('대기 중인 글감')

      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['전체', '대기', '진행', '완료'])
    })

    it('진행 탭을 누르면 주소가 ?status=doing이 되고 그 status로 다시 조회한 목록만 보여야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('대기 중인 글감')

      await user.click(screen.getByRole('tab', { name: '진행' }))

      await waitFor(() => expect(screen.queryByText('대기 중인 글감')).not.toBeInTheDocument())
      expect(await screen.findByText('진행 중인 글감')).toBeInTheDocument()
      expect(lastRequestedStatus()).toBe('doing')
      expect(currentSearch().get('status')).toBe('doing')
      expect(screen.getByRole('tab', { name: '진행' })).toHaveAttribute('aria-selected', 'true')
    })

    it('전체 탭을 누르면 status 쿼리가 주소에서 지워지고 전체를 조회해야 한다', async () => {
      const user = userEvent.setup()
      renderPage('/ideas?status=doing')
      await screen.findByText('진행 중인 글감')

      await user.click(screen.getByRole('tab', { name: '전체' }))

      expect(await screen.findByText('대기 중인 글감')).toBeInTheDocument()
      expect(currentSearch().has('status')).toBe(false)
      expect(lastRequestedStatus()).toBeUndefined()
    })

    it('행을 누르면 상세 모달이 열려 메모 전문이 보이고, 닫으면 모달이 사라져야 한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByText('진행 중인 글감'))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/진행 메모 첫 줄/)).toBeInTheDocument()
      expect(within(dialog).getByText(/진행 메모 둘째 줄/)).toBeInTheDocument()

      await user.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })

  describe('경계', () => {
    it('주소의 status가 허용되지 않은 값이면 전체로 취급해 status 없이 조회해야 한다', async () => {
      renderPage('/ideas?status=archived')

      await screen.findByText('대기 중인 글감')

      expect(screen.getByRole('tab', { name: '전체' })).toHaveAttribute('aria-selected', 'true')
      expect(lastRequestedStatus()).toBeUndefined()
    })

    it('주소가 ?status=done이면 완료 탭이 선택되고 done으로 조회해야 한다', async () => {
      renderPage('/ideas?status=done')

      await waitFor(() => expect(mockedFetchIdeas).toHaveBeenCalled())

      expect(screen.getByRole('tab', { name: '완료' })).toHaveAttribute('aria-selected', 'true')
      expect(lastRequestedStatus()).toBe('done')
    })

    it('글감이 하나도 없으면 "글감이 없습니다." 안내가 보여야 한다', async () => {
      mockedFetchIdeas.mockResolvedValue({ data: [] })

      renderPage()

      expect(await screen.findByText('글감이 없습니다.')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('탭을 바꿔 조회하는 동안에는 불러오는 중이 보이고 이전 탭의 목록이 남지 않아야 한다', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('대기 중인 글감')
      const pending = createDeferred()
      mockedFetchIdeas.mockReturnValueOnce(pending.promise)

      await user.click(screen.getByRole('tab', { name: '진행' }))

      expect(await screen.findByText('불러오는 중...')).toBeInTheDocument()
      expect(screen.queryByText('대기 중인 글감')).not.toBeInTheDocument()
      expect(screen.queryByText('진행 중인 글감')).not.toBeInTheDocument()

      pending.resolve({ data: [DOING_IDEA] })

      expect(await screen.findByText('진행 중인 글감')).toBeInTheDocument()
    })
  })

  describe('예외', () => {
    it('조회가 실패하면 오류 문구와 "다시 시도" 버튼이 보여야 한다', async () => {
      mockedFetchIdeas.mockRejectedValue(new Error('글감을 불러오지 못했습니다.'))

      renderPage()

      expect(await screen.findByText('글감을 불러오지 못했습니다.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('"다시 시도"를 누르면 다시 조회해 성공하면 목록이 보여야 한다', async () => {
      const user = userEvent.setup()
      mockedFetchIdeas.mockRejectedValueOnce(new Error('글감을 불러오지 못했습니다.'))
      renderPage()

      await user.click(await screen.findByRole('button', { name: '다시 시도' }))

      expect(await screen.findByText('진행 중인 글감')).toBeInTheDocument()
      expect(screen.queryByText('글감을 불러오지 못했습니다.')).not.toBeInTheDocument()
      expect(mockedFetchIdeas).toHaveBeenCalledTimes(2)
    })
  })
})
