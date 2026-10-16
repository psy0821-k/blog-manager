import { useCallback, useRef, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import { deletePost, updatePostPublished } from './posts-api'
import type { PostListItem, PostType } from './post-types'

const NOT_FOUND_MESSAGE = '이미 삭제된 글입니다'

type PostAction = 'toggle' | 'delete'

const ACTION_MESSAGES: Record<PostAction, { network: string; failure: (status: number) => string }> = {
  toggle: {
    network: '네트워크 오류로 상태를 바꾸지 못했습니다.',
    failure: status => `상태를 바꾸지 못했습니다. (${status})`,
  },
  delete: {
    network: '네트워크 오류로 삭제하지 못했습니다.',
    failure: status => `삭제하지 못했습니다. (${status})`,
  },
}

type PostRef = Pick<PostListItem, 'id' | 'slug'>

export interface UsePostActionsResult {
  /** 해당 글(id)의 전환·삭제 요청이 진행 중인지 */
  isPending: (id: string) => boolean
  /** 마지막 전환/삭제 실패 안내. 없으면 null */
  errorMessage: string | null
  /** published=true면 발행, false면 임시저장으로 바꾼다. 같은 글이 처리 중이면 무시한다. */
  togglePublished: (type: PostType, post: PostRef, published: boolean) => Promise<void>
  /**
   * 글을 삭제한다. 요청이 실행돼 끝났으면(성공·404·실패 무관) true,
   * 같은 글이 이미 처리 중이라 무시했으면 false로 resolve한다. 거부하지 않는다.
   * onDone을 넘기면 성공/404 때 훅의 onSuccess 대신 호출한다.
   */
  remove: (type: PostType, post: PostRef, onDone?: () => void) => Promise<boolean>
}

function toErrorMessage(error: unknown, action: PostAction): string {
  const messages = ACTION_MESSAGES[action]

  if (!(error instanceof ApiError)) {
    return messages.network
  }

  return error.status === 404 ? NOT_FOUND_MESSAGE : messages.failure(error.status)
}

/** onSuccess는 요청이 성공했거나 글이 이미 없을 때(404) 목록을 다시 불러오라고 호출된다. */
export function usePostActions(onSuccess: () => void): UsePostActionsResult {
  const [pendingState, setPendingState] = useState<ReadonlySet<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // 같은 틱의 연속 호출은 state 갱신 전이라 ref로 동기 차단한다
  const pendingIds = useRef<Set<string>>(new Set())

  const isPending = useCallback((id: string) => pendingState.has(id), [pendingState])

  /** 처리 중 표시·중복 차단·오류 안내를 공유한다. 실행했으면 true, 중복이라 무시했으면 false. */
  const runAction = useCallback(
    async (id: string, action: PostAction, request: () => Promise<void>, onDone: () => void): Promise<boolean> => {
      if (pendingIds.current.has(id)) {
        return false
      }

      pendingIds.current.add(id)
      setPendingState(prev => new Set(prev).add(id))
      setErrorMessage(null)

      try {
        await request()
        onDone()
      } catch (error) {
        setErrorMessage(toErrorMessage(error, action))

        if (error instanceof ApiError && error.status === 404) {
          onDone()
        }
      } finally {
        pendingIds.current.delete(id)
        setPendingState(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }

      return true
    },
    [],
  )

  const togglePublished = useCallback(
    async (type: PostType, post: PostRef, published: boolean) => {
      await runAction(post.id, 'toggle', () => updatePostPublished(type, post.slug, published), onSuccess)
    },
    [onSuccess, runAction],
  )

  const remove = useCallback(
    (type: PostType, post: PostRef, onDone?: () => void) =>
      runAction(post.id, 'delete', () => deletePost(type, post.slug), onDone ?? onSuccess),
    [onSuccess, runAction],
  )

  return { isPending, errorMessage, togglePublished, remove }
}
