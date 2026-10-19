import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api-client'
import { updateIdea } from '../ideas-api'
import type { SavedIdea } from '../ideas-api'
import { useIdeaActions } from '../use-idea-actions'

vi.mock('../ideas-api', () => ({ updateIdea: vi.fn() }))

const mockedUpdateIdea = vi.mocked(updateIdea)

const UPDATED: SavedIdea = {
  id: 'idea-1',
  title: '제목',
  memo: '- 메모',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

/** 테스트가 끝나는 시점을 쥐는 지연된 요청 */
function createDeferred() {
  let resolve!: (idea: SavedIdea) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<SavedIdea>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

beforeEach(() => {
  mockedUpdateIdea.mockReset()
  mockedUpdateIdea.mockResolvedValue(UPDATED)
})

describe('useIdeaActions', () => {
  describe('정상', () => {
    it('changeStatus가 성공하면 updateIdea(id, { status })를 호출하고 onSuccess를 한 번 호출해야 한다', async () => {
      const onSuccess = vi.fn()
      const { result } = renderHook(() => useIdeaActions(onSuccess))

      await act(async () => {
        await result.current.changeStatus('idea-1', 'doing')
      })

      expect(mockedUpdateIdea).toHaveBeenCalledTimes(1)
      expect(mockedUpdateIdea).toHaveBeenCalledWith('idea-1', { status: 'doing' })
      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(result.current.errorMessage).toBeNull()
    })

    it('요청이 진행되는 동안 해당 id의 isPending이 true이고 끝나면 false여야 한다', async () => {
      const deferred = createDeferred()
      mockedUpdateIdea.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      expect(result.current.isPending('idea-1')).toBe(false)

      let running!: Promise<void>
      act(() => {
        running = result.current.changeStatus('idea-1', 'doing')
      })
      expect(result.current.isPending('idea-1')).toBe(true)

      await act(async () => {
        deferred.resolve(UPDATED)
        await running
      })
      expect(result.current.isPending('idea-1')).toBe(false)
    })
  })

  describe('경계', () => {
    it('한 글감이 처리 중이어도 다른 글감의 isPending은 false여야 한다', async () => {
      mockedUpdateIdea.mockReturnValue(createDeferred().promise)
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      act(() => {
        void result.current.changeStatus('idea-1', 'doing')
      })

      expect(result.current.isPending('idea-1')).toBe(true)
      expect(result.current.isPending('idea-2')).toBe(false)
    })

    it('같은 글감이 처리 중일 때 changeStatus를 다시 부르면 요청이 한 번만 가야 한다(같은 틱 연속 호출 포함)', async () => {
      const deferred = createDeferred()
      mockedUpdateIdea.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      act(() => {
        void result.current.changeStatus('idea-1', 'doing')
        void result.current.changeStatus('idea-1', 'done')
      })

      expect(mockedUpdateIdea).toHaveBeenCalledTimes(1)

      await act(async () => {
        deferred.resolve(UPDATED)
      })
    })

    it('새 요청을 시작하면 이전 errorMessage가 지워져야 한다', async () => {
      mockedUpdateIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      await act(async () => {
        await result.current.changeStatus('idea-1', 'doing')
      })
      expect(result.current.errorMessage).not.toBeNull()

      mockedUpdateIdea.mockReturnValue(createDeferred().promise)
      act(() => {
        void result.current.changeStatus('idea-1', 'doing')
      })

      expect(result.current.errorMessage).toBeNull()
    })
  })

  describe('예외', () => {
    it('404이면 "이미 삭제된 글감입니다"가 errorMessage이고 onSuccess를 호출해야 한다', async () => {
      mockedUpdateIdea.mockRejectedValue(new ApiError(404, '없음'))
      const onSuccess = vi.fn()
      const { result } = renderHook(() => useIdeaActions(onSuccess))

      await act(async () => {
        await result.current.changeStatus('idea-1', 'doing')
      })

      expect(result.current.errorMessage).toBe('이미 삭제된 글감입니다')
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    it.each([400, 500])('%i이면 "상태를 바꾸지 못했습니다. (status)"가 errorMessage이고 onSuccess는 호출하지 않아야 한다', async (status) => {
      mockedUpdateIdea.mockRejectedValue(new ApiError(status, '실패'))
      const onSuccess = vi.fn()
      const { result } = renderHook(() => useIdeaActions(onSuccess))

      await act(async () => {
        await result.current.changeStatus('idea-1', 'doing')
      })

      expect(result.current.errorMessage).toBe(`상태를 바꾸지 못했습니다. (${status})`)
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('ApiError가 아닌 오류이면 "네트워크 오류로 상태를 바꾸지 못했습니다."가 errorMessage여야 한다', async () => {
      mockedUpdateIdea.mockRejectedValue(new TypeError('Failed to fetch'))
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      await act(async () => {
        await result.current.changeStatus('idea-1', 'doing')
      })

      expect(result.current.errorMessage).toBe('네트워크 오류로 상태를 바꾸지 못했습니다.')
    })

    it('실패해도 changeStatus는 거부하지 않고 resolve해야 한다', async () => {
      mockedUpdateIdea.mockRejectedValue(new ApiError(500, '실패'))
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      await act(async () => {
        await expect(result.current.changeStatus('idea-1', 'doing')).resolves.toBeUndefined()
      })
    })
  })
})
