import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api-client'
import { updateIdea } from '../ideas-api'
import type { SavedIdea, UpdateIdeaInput } from '../ideas-api'
import { toSaveErrorMessage } from '../use-save-idea'
import { useUpdateIdea } from '../use-update-idea'

vi.mock('../ideas-api', () => ({ updateIdea: vi.fn() }))

const mockedUpdateIdea = vi.mocked(updateIdea)

const INPUT: UpdateIdeaInput = { title: '새 제목', memo: '- 새 메모', type: 'LAB' }

const UPDATED: SavedIdea = {
  id: 'idea-1',
  ...(INPUT as Required<UpdateIdeaInput>),
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

/** 테스트가 끝나는 시점을 쥐는 지연된 요청 */
function createDeferred() {
  let resolve!: (idea: SavedIdea) => void
  const promise = new Promise<SavedIdea>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

beforeEach(() => {
  mockedUpdateIdea.mockReset()
  mockedUpdateIdea.mockResolvedValue(UPDATED)
})

describe('useUpdateIdea', () => {
  describe('정상', () => {
    it('update가 성공하면 updateIdea(id, input)을 호출하고 서버가 돌려준 글감을 반환해야 한다', async () => {
      const { result } = renderHook(() => useUpdateIdea())

      let updated: SavedIdea | null = null
      await act(async () => {
        updated = await result.current.update('idea-1', INPUT)
      })

      expect(mockedUpdateIdea).toHaveBeenCalledTimes(1)
      expect(mockedUpdateIdea).toHaveBeenCalledWith('idea-1', INPUT)
      expect(updated).toEqual(UPDATED)
      expect(result.current.errorMessage).toBeNull()
    })

    it('요청이 진행되는 동안 isSaving이 true이고 끝나면 false여야 한다', async () => {
      const deferred = createDeferred()
      mockedUpdateIdea.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => useUpdateIdea())

      expect(result.current.isSaving).toBe(false)

      let running!: Promise<SavedIdea | null>
      act(() => {
        running = result.current.update('idea-1', INPUT)
      })
      expect(result.current.isSaving).toBe(true)

      await act(async () => {
        deferred.resolve(UPDATED)
        await running
      })
      expect(result.current.isSaving).toBe(false)
    })
  })

  describe('경계', () => {
    it('이미 저장 중일 때 update를 다시 부르면 요청 없이 null을 반환해야 한다(같은 틱 연속 호출 포함)', async () => {
      const deferred = createDeferred()
      mockedUpdateIdea.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => useUpdateIdea())

      let second: SavedIdea | null | undefined
      await act(async () => {
        void result.current.update('idea-1', INPUT)
        second = await result.current.update('idea-1', INPUT)
      })

      expect(second).toBeNull()
      expect(mockedUpdateIdea).toHaveBeenCalledTimes(1)

      await act(async () => {
        deferred.resolve(UPDATED)
      })
    })

    it('새 update를 시작하면 이전 errorMessage가 지워져야 한다', async () => {
      mockedUpdateIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      const { result } = renderHook(() => useUpdateIdea())

      await act(async () => {
        await result.current.update('idea-1', INPUT)
      })
      expect(result.current.errorMessage).not.toBeNull()

      mockedUpdateIdea.mockReturnValue(createDeferred().promise)
      act(() => {
        void result.current.update('idea-1', INPUT)
      })

      expect(result.current.errorMessage).toBeNull()
    })

    it('resetError를 부르면 errorMessage가 지워져야 한다', async () => {
      mockedUpdateIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      const { result } = renderHook(() => useUpdateIdea())
      await act(async () => {
        await result.current.update('idea-1', INPUT)
      })

      act(() => result.current.resetError())

      expect(result.current.errorMessage).toBeNull()
    })
  })

  describe('예외', () => {
    it('404이면 "이미 삭제된 글감입니다"가 errorMessage이고 null을 반환해야 한다', async () => {
      mockedUpdateIdea.mockRejectedValue(new ApiError(404, '없음'))
      const { result } = renderHook(() => useUpdateIdea())

      let updated: SavedIdea | null | undefined
      await act(async () => {
        updated = await result.current.update('idea-1', INPUT)
      })

      expect(updated).toBeNull()
      expect(result.current.errorMessage).toBe('이미 삭제된 글감입니다')
    })

    it.each([400, 401, 403])('%i이면 toSaveErrorMessage와 같은 문구가 errorMessage이고 null을 반환해야 한다', async (status) => {
      const error = new ApiError(status, '실패')
      mockedUpdateIdea.mockRejectedValue(error)
      const { result } = renderHook(() => useUpdateIdea())

      let updated: SavedIdea | null | undefined
      await act(async () => {
        updated = await result.current.update('idea-1', INPUT)
      })

      expect(updated).toBeNull()
      expect(result.current.errorMessage).toBe(toSaveErrorMessage(error))
    })

    it('500이면 서버 오류 문구가, ApiError가 아닌 오류이면 네트워크 문구가 errorMessage여야 한다', async () => {
      mockedUpdateIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      const { result } = renderHook(() => useUpdateIdea())

      await act(async () => {
        await result.current.update('idea-1', INPUT)
      })
      expect(result.current.errorMessage).toBe('서버 오류로 저장하지 못했어요. 잠시 후 다시 시도해 주세요. (500)')

      mockedUpdateIdea.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      await act(async () => {
        await result.current.update('idea-1', INPUT)
      })
      expect(result.current.errorMessage).toBe('서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.')
    })

    it('실패해도 update는 거부하지 않고 resolve해야 한다', async () => {
      mockedUpdateIdea.mockRejectedValue(new ApiError(500, '실패'))
      const { result } = renderHook(() => useUpdateIdea())

      await act(async () => {
        await expect(result.current.update('idea-1', INPUT)).resolves.toBeNull()
      })
    })
  })
})
