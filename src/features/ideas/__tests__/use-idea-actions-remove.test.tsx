import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api-client'
import { deleteIdea, updateIdea } from '../ideas-api'
import type { SavedIdea } from '../ideas-api'
import { useIdeaActions } from '../use-idea-actions'

vi.mock('../ideas-api', () => ({ updateIdea: vi.fn(), deleteIdea: vi.fn() }))

const mockedUpdateIdea = vi.mocked(updateIdea)
const mockedDeleteIdea = vi.mocked(deleteIdea)

const UPDATED: SavedIdea = {
  id: 'idea-1',
  title: '제목',
  memo: '- 메모',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

/** 테스트가 끝나는 시점을 쥐는 지연된 요청 */
function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

beforeEach(() => {
  mockedUpdateIdea.mockReset()
  mockedDeleteIdea.mockReset()
  mockedUpdateIdea.mockResolvedValue(UPDATED)
  mockedDeleteIdea.mockResolvedValue(undefined)
})

describe('useIdeaActions.remove', () => {
  describe('정상', () => {
    it('remove가 성공하면 deleteIdea(id)를 호출하고 onSuccess를 한 번 호출하며 true를 반환해야 한다', async () => {
      const onSuccess = vi.fn()
      const { result } = renderHook(() => useIdeaActions(onSuccess))

      let handled: boolean | undefined
      await act(async () => {
        handled = await result.current.remove('idea-1')
      })

      expect(mockedDeleteIdea).toHaveBeenCalledTimes(1)
      expect(mockedDeleteIdea).toHaveBeenCalledWith('idea-1')
      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(handled).toBe(true)
      expect(result.current.errorMessage).toBeNull()
    })

    it('요청이 진행되는 동안 해당 id의 isPending이 true이고 끝나면 false여야 한다', async () => {
      const deferred = createDeferred<void>()
      mockedDeleteIdea.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      expect(result.current.isPending('idea-1')).toBe(false)

      let running!: Promise<boolean>
      act(() => {
        running = result.current.remove('idea-1')
      })
      expect(result.current.isPending('idea-1')).toBe(true)

      await act(async () => {
        deferred.resolve()
        await running
      })
      expect(result.current.isPending('idea-1')).toBe(false)
    })
  })

  describe('경계', () => {
    it('같은 글감이 처리 중일 때 remove를 다시 부르면 요청 없이 false를 반환해야 한다(같은 틱 연속 호출 포함)', async () => {
      const deferred = createDeferred<void>()
      mockedDeleteIdea.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      let second: boolean | undefined
      await act(async () => {
        void result.current.remove('idea-1')
        second = await result.current.remove('idea-1')
      })

      expect(second).toBe(false)
      expect(mockedDeleteIdea).toHaveBeenCalledTimes(1)

      await act(async () => {
        deferred.resolve()
      })
    })

    it('같은 글감이 상태 변경 중일 때 remove를 부르면 요청 없이 false를 반환해야 한다', async () => {
      const deferred = createDeferred<SavedIdea>()
      mockedUpdateIdea.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      let handled: boolean | undefined
      await act(async () => {
        void result.current.changeStatus('idea-1', 'doing')
        handled = await result.current.remove('idea-1')
      })

      expect(handled).toBe(false)
      expect(mockedDeleteIdea).not.toHaveBeenCalled()

      await act(async () => {
        deferred.resolve(UPDATED)
      })
    })

    it('새 요청을 시작하면 이전 errorMessage가 지워져야 한다', async () => {
      mockedDeleteIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      await act(async () => {
        await result.current.remove('idea-1')
      })
      expect(result.current.errorMessage).not.toBeNull()

      mockedDeleteIdea.mockReturnValue(createDeferred<void>().promise)
      act(() => {
        void result.current.remove('idea-1')
      })

      expect(result.current.errorMessage).toBeNull()
    })

    it('changeStatus의 오류 문구는 그대로여야 한다', async () => {
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      mockedUpdateIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      await act(async () => {
        await result.current.changeStatus('idea-1', 'doing')
      })
      expect(result.current.errorMessage).toBe('상태를 바꾸지 못했습니다. (500)')

      mockedUpdateIdea.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      await act(async () => {
        await result.current.changeStatus('idea-1', 'doing')
      })
      expect(result.current.errorMessage).toBe('네트워크 오류로 상태를 바꾸지 못했습니다.')

      mockedUpdateIdea.mockRejectedValueOnce(new ApiError(404, '없음'))
      await act(async () => {
        await result.current.changeStatus('idea-1', 'doing')
      })
      expect(result.current.errorMessage).toBe('이미 삭제된 글감입니다')
    })
  })

  describe('예외', () => {
    it('404이면 "이미 삭제된 글감입니다"가 errorMessage이고 onSuccess를 호출하며 true를 반환해야 한다', async () => {
      mockedDeleteIdea.mockRejectedValue(new ApiError(404, '없음'))
      const onSuccess = vi.fn()
      const { result } = renderHook(() => useIdeaActions(onSuccess))

      let handled: boolean | undefined
      await act(async () => {
        handled = await result.current.remove('idea-1')
      })

      expect(result.current.errorMessage).toBe('이미 삭제된 글감입니다')
      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(handled).toBe(true)
    })

    it.each([400, 500])('%i이면 "삭제하지 못했습니다. (status)"가 errorMessage이고 onSuccess는 호출하지 않으며 true를 반환해야 한다', async (status) => {
      mockedDeleteIdea.mockRejectedValue(new ApiError(status, '실패'))
      const onSuccess = vi.fn()
      const { result } = renderHook(() => useIdeaActions(onSuccess))

      let handled: boolean | undefined
      await act(async () => {
        handled = await result.current.remove('idea-1')
      })

      expect(result.current.errorMessage).toBe(`삭제하지 못했습니다. (${status})`)
      expect(onSuccess).not.toHaveBeenCalled()
      expect(handled).toBe(true)
    })

    it('ApiError가 아닌 오류이면 "네트워크 오류로 삭제하지 못했습니다."가 errorMessage여야 한다', async () => {
      mockedDeleteIdea.mockRejectedValue(new TypeError('Failed to fetch'))
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      await act(async () => {
        await result.current.remove('idea-1')
      })

      expect(result.current.errorMessage).toBe('네트워크 오류로 삭제하지 못했습니다.')
    })

    it('실패해도 remove는 거부하지 않고 resolve해야 한다', async () => {
      mockedDeleteIdea.mockRejectedValue(new ApiError(500, '실패'))
      const { result } = renderHook(() => useIdeaActions(vi.fn()))

      await act(async () => {
        await expect(result.current.remove('idea-1')).resolves.toBe(true)
      })
    })
  })
})
