import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api-client'
import { deletePost, updatePostPublished } from '../posts-api'
import { usePostActions } from '../use-post-actions'

vi.mock('../posts-api', () => ({ updatePostPublished: vi.fn(), deletePost: vi.fn() }))

const mockedUpdate = vi.mocked(updatePostPublished)
const mockedDelete = vi.mocked(deletePost)

const POST_A = { id: 'a', slug: 'slug-a' }
const POST_B = { id: 'b', slug: 'slug-b' }

/** 테스트가 끝나는 시점을 쥐는 지연된 요청 */
function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

const onSuccess = vi.fn()
const onDone = vi.fn()

beforeEach(() => {
  mockedUpdate.mockReset()
  mockedUpdate.mockResolvedValue(undefined)
  mockedDelete.mockReset()
  mockedDelete.mockResolvedValue(undefined)
  onSuccess.mockReset()
  onDone.mockReset()
  sessionStorage.clear()
})

describe('usePostActions', () => {
  describe('정상', () => {
    it('처음에는 isPending이 모두 false이고 errorMessage가 null이어야 한다', () => {
      const { result } = renderHook(() => usePostActions(onSuccess))

      expect(result.current.isPending('a')).toBe(false)
      expect(result.current.isPending('b')).toBe(false)
      expect(result.current.errorMessage).toBeNull()
    })

    it('togglePublished를 호출하면 updatePostPublished가 한 번 호출되고 요청이 끝나기 전에는 isPending이 true여야 한다', async () => {
      const deferred = createDeferred()
      mockedUpdate.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => usePostActions(onSuccess))

      let toggled!: Promise<void>
      act(() => {
        toggled = result.current.togglePublished('PROJECT', POST_A, true)
      })

      expect(mockedUpdate).toHaveBeenCalledTimes(1)
      expect(mockedUpdate).toHaveBeenCalledWith('PROJECT', 'slug-a', true)
      expect(result.current.isPending('a')).toBe(true)

      await act(async () => {
        deferred.resolve()
        await toggled
      })
    })

    it('요청이 성공하면 onSuccess가 한 번 호출되고 isPending이 false이며 errorMessage는 null이어야 한다', async () => {
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.togglePublished('PROJECT', POST_A, false)
      })

      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(result.current.isPending('a')).toBe(false)
      expect(result.current.errorMessage).toBeNull()
    })

    it('LAB 글도 같은 흐름으로 updatePostPublished(LAB, slug, published)를 호출해야 한다', async () => {
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.togglePublished('LAB', POST_A, true)
      })

      expect(mockedUpdate).toHaveBeenCalledWith('LAB', 'slug-a', true)
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('경계', () => {
    it('같은 글이 처리 중일 때 같은 틱의 연속 호출을 포함해 다시 호출해도 요청은 한 번만 가야 한다', async () => {
      const deferred = createDeferred()
      mockedUpdate.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => usePostActions(onSuccess))
      const { togglePublished } = result.current

      let first!: Promise<void>
      act(() => {
        first = togglePublished('PROJECT', POST_A, true)
        void togglePublished('PROJECT', POST_A, true)
      })

      expect(mockedUpdate).toHaveBeenCalledTimes(1)

      await act(async () => {
        await result.current.togglePublished('PROJECT', POST_A, true)
      })

      expect(mockedUpdate).toHaveBeenCalledTimes(1)

      await act(async () => {
        deferred.resolve()
        await first
      })
    })

    it('글 A가 처리 중이어도 글 B는 요청이 가고 isPending이 서로 독립이며 한쪽이 끝나도 다른 쪽은 처리 중으로 남아야 한다', async () => {
      const deferredA = createDeferred()
      const deferredB = createDeferred()
      mockedUpdate.mockReturnValueOnce(deferredA.promise).mockReturnValueOnce(deferredB.promise)
      const { result } = renderHook(() => usePostActions(onSuccess))

      let toggledA!: Promise<void>
      let toggledB!: Promise<void>
      act(() => {
        toggledA = result.current.togglePublished('PROJECT', POST_A, true)
      })
      act(() => {
        toggledB = result.current.togglePublished('PROJECT', POST_B, true)
      })

      expect(mockedUpdate).toHaveBeenCalledTimes(2)
      expect(mockedUpdate).toHaveBeenLastCalledWith('PROJECT', 'slug-b', true)
      expect(result.current.isPending('a')).toBe(true)
      expect(result.current.isPending('b')).toBe(true)

      await act(async () => {
        deferredA.resolve()
        await toggledA
      })

      expect(result.current.isPending('a')).toBe(false)
      expect(result.current.isPending('b')).toBe(true)

      await act(async () => {
        deferredB.resolve()
        await toggledB
      })
    })

    it('실패한 뒤 같은 글을 다시 전환할 수 있고 새 전환을 시작하면 이전 errorMessage가 null로 지워져야 한다', async () => {
      mockedUpdate.mockRejectedValueOnce(new ApiError(500, 'x'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.togglePublished('PROJECT', POST_A, true)
      })

      expect(result.current.errorMessage).not.toBeNull()

      const deferred = createDeferred()
      mockedUpdate.mockReturnValueOnce(deferred.promise)
      let retry!: Promise<void>
      act(() => {
        retry = result.current.togglePublished('PROJECT', POST_A, true)
      })

      expect(mockedUpdate).toHaveBeenCalledTimes(2)
      expect(result.current.errorMessage).toBeNull()

      await act(async () => {
        deferred.resolve()
        await retry
      })
    })

    it('한 번 실패한 뒤 다음 전환이 성공하면 errorMessage가 null이어야 한다', async () => {
      mockedUpdate.mockRejectedValueOnce(new ApiError(500, 'x'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.togglePublished('PROJECT', POST_A, true)
      })
      await act(async () => {
        await result.current.togglePublished('PROJECT', POST_A, true)
      })

      expect(result.current.errorMessage).toBeNull()
    })
  })

  describe('예외', () => {
    it.each([500, 400])('ApiError %i이면 상태를 바꾸지 못했다는 문구가 남고 onSuccess는 호출되지 않으며 isPending은 false여야 한다', async (status) => {
      mockedUpdate.mockRejectedValue(new ApiError(status, '요청에 실패했습니다.'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.togglePublished('PROJECT', POST_A, true)
      })

      expect(result.current.errorMessage).toBe(`상태를 바꾸지 못했습니다. (${status})`)
      expect(onSuccess).not.toHaveBeenCalled()
      expect(result.current.isPending('a')).toBe(false)
    })

    it('ApiError가 아닌 거부(네트워크 오류)이면 네트워크 문구가 남고 onSuccess는 호출되지 않으며 togglePublished는 reject하지 않아야 한다', async () => {
      mockedUpdate.mockRejectedValue(new TypeError('network'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await expect(result.current.togglePublished('PROJECT', POST_A, true)).resolves.toBeUndefined()
      })

      expect(result.current.errorMessage).toBe('네트워크 오류로 상태를 바꾸지 못했습니다.')
      expect(onSuccess).not.toHaveBeenCalled()
      expect(result.current.isPending('a')).toBe(false)
    })

    it('ApiError(404)이면 이미 삭제된 글 문구가 남고 onSuccess가 한 번 호출되며 isPending은 false여야 한다', async () => {
      mockedUpdate.mockRejectedValue(new ApiError(404, '요청에 실패했습니다.'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.togglePublished('PROJECT', POST_A, true)
      })

      expect(result.current.errorMessage).toBe('이미 삭제된 글입니다')
      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(result.current.isPending('a')).toBe(false)
    })

    it.each([401, 403])('ApiError %i이면 상태를 바꾸지 못했다는 문구가 남고 onSuccess는 호출되지 않아야 한다', async (status) => {
      mockedUpdate.mockRejectedValue(new ApiError(status, '요청에 실패했습니다.'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.togglePublished('PROJECT', POST_A, true)
      })

      expect(result.current.errorMessage).toBe(`상태를 바꾸지 못했습니다. (${status})`)
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('오류 문구에 토큰 값이나 응답 본문이 포함되지 않아야 한다', async () => {
      const token = 'header.secret-payload.signature'
      sessionStorage.setItem('blog-manager-token', token)
      mockedUpdate.mockRejectedValue(new ApiError(500, `서버 본문 ${token}`))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.togglePublished('PROJECT', POST_A, true)
      })

      expect(result.current.errorMessage).not.toBeNull()
      expect(result.current.errorMessage).not.toContain(token)
      expect(result.current.errorMessage).not.toContain('서버 본문')
    })
  })
})

describe('usePostActions.remove', () => {
  describe('정상', () => {
    it('remove를 호출하면 deletePost가 한 번 호출되고 요청이 끝나기 전에는 isPending이 true여야 한다', async () => {
      const deferred = createDeferred()
      mockedDelete.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => usePostActions(onSuccess))

      let removed!: Promise<boolean>
      act(() => {
        removed = result.current.remove('PROJECT', POST_A)
      })

      expect(mockedDelete).toHaveBeenCalledTimes(1)
      expect(mockedDelete).toHaveBeenCalledWith('PROJECT', 'slug-a')
      expect(result.current.isPending('a')).toBe(true)

      await act(async () => {
        deferred.resolve()
        await removed
      })
    })

    it('요청이 성공하면 onSuccess가 한 번 호출되고 isPending이 false이며 errorMessage는 null이고 true로 resolve해야 한다', async () => {
      const { result } = renderHook(() => usePostActions(onSuccess))

      let handled: boolean | undefined
      await act(async () => {
        handled = await result.current.remove('PROJECT', POST_A)
      })

      expect(handled).toBe(true)
      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(result.current.isPending('a')).toBe(false)
      expect(result.current.errorMessage).toBeNull()
    })

    it('onDone을 넘기면 성공 시 onDone만 한 번 호출하고 훅의 onSuccess는 호출하지 않아야 한다', async () => {
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.remove('PROJECT', POST_A, onDone)
      })

      expect(onDone).toHaveBeenCalledTimes(1)
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('LAB 글도 같은 흐름으로 deletePost(LAB, slug)를 호출해야 한다', async () => {
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.remove('LAB', POST_A)
      })

      expect(mockedDelete).toHaveBeenCalledWith('LAB', 'slug-a')
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('경계', () => {
    it('같은 글이 처리 중일 때 같은 틱의 연속 호출을 포함해 다시 호출해도 요청은 한 번만 가고 두 번째 호출은 false로 resolve해야 한다', async () => {
      const deferred = createDeferred()
      mockedDelete.mockReturnValue(deferred.promise)
      const { result } = renderHook(() => usePostActions(onSuccess))
      const { remove } = result.current

      let first!: Promise<boolean>
      let second!: Promise<boolean>
      act(() => {
        first = remove('PROJECT', POST_A)
        second = remove('PROJECT', POST_A)
      })

      expect(mockedDelete).toHaveBeenCalledTimes(1)
      await expect(second).resolves.toBe(false)

      await act(async () => {
        deferred.resolve()
        await first
      })

      expect(mockedDelete).toHaveBeenCalledTimes(1)
    })

    it('같은 글에 togglePublished가 처리 중이면 remove가 무시되고 remove가 처리 중이면 togglePublished가 무시돼야 한다', async () => {
      const toggleDeferred = createDeferred()
      mockedUpdate.mockReturnValue(toggleDeferred.promise)
      const { result } = renderHook(() => usePostActions(onSuccess))

      let toggled!: Promise<void>
      act(() => {
        toggled = result.current.togglePublished('PROJECT', POST_A, true)
      })

      let ignored: boolean | undefined
      await act(async () => {
        ignored = await result.current.remove('PROJECT', POST_A)
      })

      expect(ignored).toBe(false)
      expect(mockedUpdate).toHaveBeenCalledTimes(1)
      expect(mockedDelete).not.toHaveBeenCalled()

      await act(async () => {
        toggleDeferred.resolve()
        await toggled
      })

      const deleteDeferred = createDeferred()
      mockedDelete.mockReturnValue(deleteDeferred.promise)
      let removed!: Promise<boolean>
      act(() => {
        removed = result.current.remove('PROJECT', POST_B)
      })

      await act(async () => {
        await result.current.togglePublished('PROJECT', POST_B, true)
      })

      expect(mockedDelete).toHaveBeenCalledTimes(1)
      expect(mockedUpdate).toHaveBeenCalledTimes(1)

      await act(async () => {
        deleteDeferred.resolve()
        await removed
      })
    })

    it('글 A가 처리 중이어도 글 B는 요청이 가고 isPending이 서로 독립이어야 한다', async () => {
      const deferredA = createDeferred()
      const deferredB = createDeferred()
      mockedDelete.mockReturnValueOnce(deferredA.promise).mockReturnValueOnce(deferredB.promise)
      const { result } = renderHook(() => usePostActions(onSuccess))

      let removedA!: Promise<boolean>
      let removedB!: Promise<boolean>
      act(() => {
        removedA = result.current.remove('PROJECT', POST_A)
      })
      act(() => {
        removedB = result.current.remove('PROJECT', POST_B)
      })

      expect(mockedDelete).toHaveBeenCalledTimes(2)
      expect(mockedDelete).toHaveBeenLastCalledWith('PROJECT', 'slug-b')
      expect(result.current.isPending('a')).toBe(true)
      expect(result.current.isPending('b')).toBe(true)

      await act(async () => {
        deferredA.resolve()
        await removedA
      })

      expect(result.current.isPending('a')).toBe(false)
      expect(result.current.isPending('b')).toBe(true)

      await act(async () => {
        deferredB.resolve()
        await removedB
      })
    })

    it('실패한 뒤 같은 글을 다시 삭제할 수 있고 새 요청을 시작하면 이전 errorMessage가 null로 지워져야 한다', async () => {
      mockedDelete.mockRejectedValueOnce(new ApiError(500, 'x'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.remove('PROJECT', POST_A)
      })

      expect(result.current.errorMessage).not.toBeNull()

      const deferred = createDeferred()
      mockedDelete.mockReturnValueOnce(deferred.promise)
      let retry!: Promise<boolean>
      act(() => {
        retry = result.current.remove('PROJECT', POST_A)
      })

      expect(mockedDelete).toHaveBeenCalledTimes(2)
      expect(result.current.errorMessage).toBeNull()

      await act(async () => {
        deferred.resolve()
        await retry
      })
    })

    it('404일 때 onDone을 넘기면 onDone이 한 번 호출되고 onSuccess는 호출되지 않아야 한다', async () => {
      mockedDelete.mockRejectedValue(new ApiError(404, 'x'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.remove('PROJECT', POST_A, onDone)
      })

      expect(onDone).toHaveBeenCalledTimes(1)
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('404일 때 onDone이 없으면 onSuccess가 한 번 호출돼야 한다', async () => {
      mockedDelete.mockRejectedValue(new ApiError(404, 'x'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.remove('PROJECT', POST_A)
      })

      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('예외', () => {
    it.each([500, 400])('ApiError %i이면 삭제하지 못했다는 문구가 남고 콜백은 호출되지 않으며 isPending은 false이고 true로 resolve해야 한다', async (status) => {
      mockedDelete.mockRejectedValue(new ApiError(status, '요청에 실패했습니다.'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      let handled: boolean | undefined
      await act(async () => {
        handled = await result.current.remove('PROJECT', POST_A, onDone)
      })

      expect(handled).toBe(true)
      expect(result.current.errorMessage).toBe(`삭제하지 못했습니다. (${status})`)
      expect(onSuccess).not.toHaveBeenCalled()
      expect(onDone).not.toHaveBeenCalled()
      expect(result.current.isPending('a')).toBe(false)
    })

    it('ApiError가 아닌 거부(네트워크 오류)이면 네트워크 문구가 남고 콜백은 호출되지 않으며 remove는 reject하지 않아야 한다', async () => {
      mockedDelete.mockRejectedValue(new TypeError('network'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await expect(result.current.remove('PROJECT', POST_A, onDone)).resolves.toBe(true)
      })

      expect(result.current.errorMessage).toBe('네트워크 오류로 삭제하지 못했습니다.')
      expect(onSuccess).not.toHaveBeenCalled()
      expect(onDone).not.toHaveBeenCalled()
      expect(result.current.isPending('a')).toBe(false)
    })

    it('ApiError(404)이면 이미 삭제된 글 문구가 남고 콜백이 한 번 호출되며 isPending은 false여야 한다', async () => {
      mockedDelete.mockRejectedValue(new ApiError(404, '요청에 실패했습니다.'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.remove('PROJECT', POST_A)
      })

      expect(result.current.errorMessage).toBe('이미 삭제된 글입니다')
      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(result.current.isPending('a')).toBe(false)
    })

    it.each([401, 403])('ApiError %i이면 삭제하지 못했다는 문구가 남고 콜백은 호출되지 않아야 한다', async (status) => {
      mockedDelete.mockRejectedValue(new ApiError(status, '요청에 실패했습니다.'))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.remove('PROJECT', POST_A, onDone)
      })

      expect(result.current.errorMessage).toBe(`삭제하지 못했습니다. (${status})`)
      expect(onSuccess).not.toHaveBeenCalled()
      expect(onDone).not.toHaveBeenCalled()
    })

    it('오류 문구에 토큰 값이나 응답 본문이 포함되지 않아야 한다', async () => {
      const token = 'header.secret-payload.signature'
      sessionStorage.setItem('blog-manager-token', token)
      mockedDelete.mockRejectedValue(new ApiError(500, `서버 본문 ${token}`))
      const { result } = renderHook(() => usePostActions(onSuccess))

      await act(async () => {
        await result.current.remove('PROJECT', POST_A)
      })

      expect(result.current.errorMessage).not.toBeNull()
      expect(result.current.errorMessage).not.toContain(token)
      expect(result.current.errorMessage).not.toContain('서버 본문')
    })
  })
})
