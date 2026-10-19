import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createIdea } from '../ideas-api'
import type { NewIdeaInput, SavedIdea } from '../ideas-api'
import { useSaveIdea } from '../use-save-idea'

vi.mock('../ideas-api', () => ({ createIdea: vi.fn() }))

const mockedCreateIdea = vi.mocked(createIdea)

const INPUT: NewIdeaInput = { title: '제목', memo: '- 메모', type: 'LAB' }

const SAVED: SavedIdea = {
  id: 'idea-1',
  ...INPUT,
  status: 'todo',
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
  mockedCreateIdea.mockReset()
  mockedCreateIdea.mockResolvedValue(SAVED)
})

describe('useSaveIdea', () => {
  describe('정상', () => {
    it('save가 성공하면 createIdea가 돌려준 글감을 반환해야 한다', async () => {
      const { result } = renderHook(() => useSaveIdea())

      let saved: SavedIdea | null = null
      await act(async () => {
        saved = await result.current.save(INPUT)
      })

      expect(saved).toEqual(SAVED)
    })

    it('저장 요청이 진행되는 동안 isSaving이 true이고 끝나면 false여야 한다', async () => {
      const deferred = createDeferred()
      mockedCreateIdea.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => useSaveIdea())

      expect(result.current.isSaving).toBe(false)

      let saving!: Promise<SavedIdea | null>
      act(() => {
        saving = result.current.save(INPUT)
      })

      expect(result.current.isSaving).toBe(true)

      await act(async () => {
        deferred.resolve(SAVED)
        await saving
      })

      expect(result.current.isSaving).toBe(false)
    })

    it('save에 넘긴 값을 createIdea에 그대로 전달해야 한다', async () => {
      const { result } = renderHook(() => useSaveIdea())

      await act(async () => {
        await result.current.save(INPUT)
      })

      expect(mockedCreateIdea).toHaveBeenCalledTimes(1)
      expect(mockedCreateIdea).toHaveBeenCalledWith(INPUT)
    })
  })

  describe('경계', () => {
    it('저장 중에 save를 다시 부르면 createIdea는 추가로 호출되지 않고 null을 반환해야 한다', async () => {
      const deferred = createDeferred()
      mockedCreateIdea.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => useSaveIdea())

      let first!: Promise<SavedIdea | null>
      act(() => {
        first = result.current.save(INPUT)
      })

      let second: SavedIdea | null = SAVED
      await act(async () => {
        second = await result.current.save(INPUT)
      })

      expect(second).toBeNull()
      expect(mockedCreateIdea).toHaveBeenCalledTimes(1)

      await act(async () => {
        deferred.resolve(SAVED)
        await first
      })
    })

    it('같은 틱에 save를 연속으로 두 번 불러도 createIdea는 한 번만 호출돼야 한다', async () => {
      const deferred = createDeferred()
      mockedCreateIdea.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => useSaveIdea())

      let first!: Promise<SavedIdea | null>
      let second!: Promise<SavedIdea | null>
      act(() => {
        first = result.current.save(INPUT)
        second = result.current.save(INPUT)
      })

      expect(mockedCreateIdea).toHaveBeenCalledTimes(1)

      await act(async () => {
        deferred.resolve(SAVED)
        await Promise.all([first, second])
      })

      await expect(second).resolves.toBeNull()
    })

    it('저장이 끝난 뒤 save를 다시 부르면 새 요청을 보내야 한다', async () => {
      const { result } = renderHook(() => useSaveIdea())

      await act(async () => {
        await result.current.save(INPUT)
      })
      await act(async () => {
        await result.current.save({ ...INPUT, title: '두 번째' })
      })

      expect(mockedCreateIdea).toHaveBeenCalledTimes(2)
      expect(mockedCreateIdea).toHaveBeenLastCalledWith({ ...INPUT, title: '두 번째' })
    })
  })

  describe('예외', () => {
    it('createIdea가 거부하면 null을 반환하고 isSaving은 false로 돌아오며 save는 거부하지 않아야 한다', async () => {
      mockedCreateIdea.mockRejectedValue(new Error('저장 실패'))
      const { result } = renderHook(() => useSaveIdea())

      let saved: SavedIdea | null = SAVED
      await act(async () => {
        saved = await result.current.save(INPUT)
      })

      expect(saved).toBeNull()
      expect(result.current.isSaving).toBe(false)
    })

    it('실패한 뒤에도 save를 다시 부를 수 있어야 한다', async () => {
      mockedCreateIdea.mockRejectedValueOnce(new Error('저장 실패'))
      const { result } = renderHook(() => useSaveIdea())

      await act(async () => {
        await result.current.save(INPUT)
      })

      let retried: SavedIdea | null = null
      await act(async () => {
        retried = await result.current.save(INPUT)
      })

      expect(retried).toEqual(SAVED)
      expect(mockedCreateIdea).toHaveBeenCalledTimes(2)
    })
  })
})
