import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api-client'
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

const INVALID_INPUT_MESSAGE = '입력한 내용을 저장할 수 없어요. 제목과 메모를 확인해 주세요.'
const AUTH_MESSAGE = '로그인이 만료됐거나 권한이 없어요. 다시 로그인해 주세요.'
const NETWORK_MESSAGE = '서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'
const serverErrorMessage = (status: number) => `서버 오류로 저장하지 못했어요. 잠시 후 다시 시도해 주세요. (${status})`

/** 테스트가 끝나는 시점을 쥐는 지연된 요청 */
function createDeferred() {
  let resolve!: (idea: SavedIdea) => void
  const promise = new Promise<SavedIdea>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

/** 저장을 한 번 시도하고 끝날 때까지 기다린다. */
async function saveOnce(result: { current: ReturnType<typeof useSaveIdea> }) {
  let saved: SavedIdea | null = SAVED
  await act(async () => {
    saved = await result.current.save(INPUT)
  })

  return saved
}

beforeEach(() => {
  mockedCreateIdea.mockReset()
  mockedCreateIdea.mockResolvedValue(SAVED)
})

describe('useSaveIdea 오류 문구', () => {
  describe('정상', () => {
    it('처음에는 errorMessage가 null이어야 한다', () => {
      const { result } = renderHook(() => useSaveIdea())

      expect(result.current.errorMessage).toBeNull()
    })

    it('save가 성공하면 errorMessage는 null이어야 한다', async () => {
      const { result } = renderHook(() => useSaveIdea())

      await saveOnce(result)

      expect(result.current.errorMessage).toBeNull()
    })

    it('resetError를 부르면 errorMessage가 null이 돼야 한다', async () => {
      mockedCreateIdea.mockRejectedValue(new ApiError(500, '실패'))
      const { result } = renderHook(() => useSaveIdea())
      await saveOnce(result)
      expect(result.current.errorMessage).not.toBeNull()

      act(() => {
        result.current.resetError()
      })

      expect(result.current.errorMessage).toBeNull()
    })
  })

  describe('예외', () => {
    it('createIdea가 ApiError(400)으로 거부하면 null을 반환하고 errorMessage는 입력 확인 문구여야 한다', async () => {
      mockedCreateIdea.mockRejectedValue(new ApiError(400, '실패'))
      const { result } = renderHook(() => useSaveIdea())

      const saved = await saveOnce(result)

      expect(saved).toBeNull()
      expect(result.current.errorMessage).toBe(INVALID_INPUT_MESSAGE)
    })

    it.each([500, 503, 404])('createIdea가 ApiError(%i)로 거부하면 errorMessage는 서버 오류 문구와 상태 코드여야 한다', async (status) => {
      mockedCreateIdea.mockRejectedValue(new ApiError(status, '실패'))
      const { result } = renderHook(() => useSaveIdea())

      await saveOnce(result)

      expect(result.current.errorMessage).toBe(serverErrorMessage(status))
    })

    it.each([401, 403])('createIdea가 ApiError(%i)로 거부하면 errorMessage는 로그인 문구여야 한다', async (status) => {
      mockedCreateIdea.mockRejectedValue(new ApiError(status, '실패'))
      const { result } = renderHook(() => useSaveIdea())

      await saveOnce(result)

      expect(result.current.errorMessage).toBe(AUTH_MESSAGE)
    })

    it('createIdea가 네트워크 오류(TypeError)로 거부하면 errorMessage는 연결 확인 문구여야 한다', async () => {
      mockedCreateIdea.mockRejectedValue(new TypeError('Failed to fetch'))
      const { result } = renderHook(() => useSaveIdea())

      await saveOnce(result)

      expect(result.current.errorMessage).toBe(NETWORK_MESSAGE)
    })

    it('ApiError의 message에 내부 상세 문구가 있어도 errorMessage에는 그 문구가 없어야 한다', async () => {
      mockedCreateIdea.mockRejectedValue(new ApiError(500, '내부 상세 문구 postgresql://leaked'))
      const { result } = renderHook(() => useSaveIdea())

      await saveOnce(result)

      expect(result.current.errorMessage).not.toContain('내부 상세 문구')
      expect(result.current.errorMessage).not.toContain('postgresql')
    })
  })

  describe('경계', () => {
    it('실패 직후 isSaving은 false여야 한다', async () => {
      mockedCreateIdea.mockRejectedValue(new ApiError(500, '실패'))
      const { result } = renderHook(() => useSaveIdea())

      await saveOnce(result)

      expect(result.current.isSaving).toBe(false)
    })

    it('실패한 뒤 save를 다시 부르면 저장하는 동안 errorMessage는 null이어야 한다', async () => {
      mockedCreateIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      const { result } = renderHook(() => useSaveIdea())
      await saveOnce(result)
      expect(result.current.errorMessage).toBe(serverErrorMessage(500))

      const deferred = createDeferred()
      mockedCreateIdea.mockReturnValue(deferred.promise)
      let retrying!: Promise<SavedIdea | null>
      act(() => {
        retrying = result.current.save(INPUT)
      })

      expect(result.current.isSaving).toBe(true)
      expect(result.current.errorMessage).toBeNull()

      await act(async () => {
        deferred.resolve(SAVED)
        await retrying
      })
    })

    it('실패한 뒤 save가 성공하면 errorMessage는 null이고 글감을 반환해야 한다', async () => {
      mockedCreateIdea.mockRejectedValueOnce(new ApiError(500, '실패'))
      const { result } = renderHook(() => useSaveIdea())
      await saveOnce(result)

      const saved = await saveOnce(result)

      expect(saved).toEqual(SAVED)
      expect(result.current.errorMessage).toBeNull()
    })
  })
})
