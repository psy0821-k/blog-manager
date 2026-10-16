import { useCallback, useRef, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import { updatePostPublished } from './posts-api'
import type { PostListItem, PostType } from './post-types'

const NOT_FOUND_MESSAGE = '이미 삭제된 글입니다'
const NETWORK_ERROR_MESSAGE = '네트워크 오류로 상태를 바꾸지 못했습니다.'

export interface UsePostActionsResult {
  /** 해당 글(id)의 전환 요청이 진행 중인지 */
  isPending: (id: string) => boolean
  /** 마지막 전환 실패 안내. 없으면 null */
  errorMessage: string | null
  /** published=true면 발행, false면 임시저장으로 바꾼다. 같은 글이 처리 중이면 무시한다. */
  togglePublished: (type: PostType, post: Pick<PostListItem, 'id' | 'slug'>, published: boolean) => Promise<void>
}

function toErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return NETWORK_ERROR_MESSAGE
  }

  return error.status === 404 ? NOT_FOUND_MESSAGE : `상태를 바꾸지 못했습니다. (${error.status})`
}

/** onSuccess는 전환이 성공했거나 글이 이미 없을 때(404) 목록을 다시 불러오라고 호출된다. */
export function usePostActions(onSuccess: () => void): UsePostActionsResult {
  const [pendingState, setPendingState] = useState<ReadonlySet<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // 같은 틱의 연속 호출은 state 갱신 전이라 ref로 동기 차단한다
  const pendingIds = useRef<Set<string>>(new Set())

  const isPending = useCallback((id: string) => pendingState.has(id), [pendingState])

  const togglePublished = useCallback(
    async (type: PostType, post: Pick<PostListItem, 'id' | 'slug'>, published: boolean) => {
      if (pendingIds.current.has(post.id)) {
        return
      }

      pendingIds.current.add(post.id)
      setPendingState(prev => new Set(prev).add(post.id))
      setErrorMessage(null)

      try {
        await updatePostPublished(type, post.slug, published)
        onSuccess()
      } catch (error) {
        setErrorMessage(toErrorMessage(error))

        if (error instanceof ApiError && error.status === 404) {
          onSuccess()
        }
      } finally {
        pendingIds.current.delete(post.id)
        setPendingState(prev => {
          const next = new Set(prev)
          next.delete(post.id)
          return next
        })
      }
    },
    [onSuccess],
  )

  return { isPending, errorMessage, togglePublished }
}
