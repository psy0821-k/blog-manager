import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchIdeas } from '../ideas-api'
import type { IdeaListResponse } from '../ideas-api'
import type { IdeaStatus } from '../idea-types'
import { useIdeas } from '../use-ideas'

vi.mock('../ideas-api', () => ({ fetchIdeas: vi.fn() }))

const mockedFetchIdeas = vi.mocked(fetchIdeas)

const LIST: IdeaListResponse = {
  data: [
    {
      id: 'idea-1',
      title: '제목',
      memo: '- 메모',
      type: 'LAB',
      status: 'doing',
      createdAt: '2026-10-19T00:00:00.000Z',
    },
  ],
}

beforeEach(() => {
  mockedFetchIdeas.mockReset()
  mockedFetchIdeas.mockResolvedValue(LIST)
})

describe('useIdeas', () => {
  describe('정상', () => {
    it('마운트하면 loading이다가 성공하면 success와 data를 돌려줘야 한다', async () => {
      const { result } = renderHook(() => useIdeas())

      expect(result.current.state.status).toBe('loading')

      await waitFor(() => expect(result.current.state.status).toBe('success'))
      expect(result.current.state).toEqual({ status: 'success', data: LIST })
    })

    it('status를 넘기면 그 status로 fetchIdeas를 호출해야 한다', async () => {
      renderHook(() => useIdeas('doing'))

      await waitFor(() => expect(mockedFetchIdeas).toHaveBeenCalledTimes(1))
      expect(mockedFetchIdeas.mock.calls[0][0]).toBe('doing')
      expect(mockedFetchIdeas.mock.calls[0][1]).toBeInstanceOf(AbortSignal)
    })

    it('status를 넘기지 않으면 undefined로 fetchIdeas를 호출해야 한다', async () => {
      renderHook(() => useIdeas())

      await waitFor(() => expect(mockedFetchIdeas).toHaveBeenCalledTimes(1))
      expect(mockedFetchIdeas.mock.calls[0][0]).toBeUndefined()
    })
  })

  describe('경계', () => {
    it('status가 바뀌면 이전 요청을 취소하고 새 status로 다시 요청해야 한다', async () => {
      const { rerender } = renderHook(({ status }: { status?: IdeaStatus }) => useIdeas(status), {
        initialProps: { status: undefined as IdeaStatus | undefined },
      })
      await waitFor(() => expect(mockedFetchIdeas).toHaveBeenCalledTimes(1))
      const firstSignal = mockedFetchIdeas.mock.calls[0][1]

      rerender({ status: 'done' })

      await waitFor(() => expect(mockedFetchIdeas).toHaveBeenCalledTimes(2))
      expect(mockedFetchIdeas.mock.calls[1][0]).toBe('done')
      expect(firstSignal.aborted).toBe(true)
    })

    it('reload를 부르면 같은 status로 다시 요청해야 한다', async () => {
      const { result } = renderHook(() => useIdeas('doing'))
      await waitFor(() => expect(result.current.state.status).toBe('success'))

      result.current.reload()

      await waitFor(() => expect(mockedFetchIdeas).toHaveBeenCalledTimes(2))
      expect(mockedFetchIdeas.mock.calls[1][0]).toBe('doing')
    })
  })

  describe('예외', () => {
    it('요청이 실패하면 error 상태와 오류를 돌려줘야 한다', async () => {
      const failure = new Error('조회 실패')
      mockedFetchIdeas.mockRejectedValue(failure)

      const { result } = renderHook(() => useIdeas())

      await waitFor(() => expect(result.current.state.status).toBe('error'))
      expect(result.current.state).toEqual({ status: 'error', error: failure })
    })
  })
})
