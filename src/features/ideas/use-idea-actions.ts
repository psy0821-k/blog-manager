import { useCallback, useRef, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import type { IdeaStatus } from './idea-types'
import { deleteIdea, updateIdea } from './ideas-api'

const NOT_FOUND_MESSAGE = '이미 삭제된 글감입니다'

type IdeaAction = 'changeStatus' | 'remove'

const ACTION_MESSAGES: Record<IdeaAction, { network: string; failure: (status: number) => string }> = {
  changeStatus: {
    network: '네트워크 오류로 상태를 바꾸지 못했습니다.',
    failure: status => `상태를 바꾸지 못했습니다. (${status})`,
  },
  remove: {
    network: '네트워크 오류로 삭제하지 못했습니다.',
    failure: status => `삭제하지 못했습니다. (${status})`,
  },
}

export interface UseIdeaActionsResult {
  /** 해당 글감(id)의 변경·삭제 요청이 진행 중인지 */
  isPending: (id: string) => boolean
  /** 마지막 변경·삭제 실패 안내. 없으면 null. 다음 요청을 시작하면 지워진다. */
  errorMessage: string | null
  /** 글감의 상태를 바꾼다. 같은 글감이 처리 중이면 무시하고, 실패해도 거부하지 않는다. */
  changeStatus: (id: string, status: IdeaStatus) => Promise<void>
  /**
   * 글감을 삭제한다. 요청이 실행돼 끝났으면(성공·404·실패 무관) true,
   * 같은 글감이 이미 처리 중이라 무시했으면 false로 resolve한다. 거부하지 않는다.
   */
  remove: (id: string) => Promise<boolean>
}

function toErrorMessage(error: unknown, action: IdeaAction): string {
  const messages = ACTION_MESSAGES[action]

  if (!(error instanceof ApiError)) {
    return messages.network
  }

  return error.status === 404 ? NOT_FOUND_MESSAGE : messages.failure(error.status)
}

/** onSuccess는 요청이 성공했거나 글감이 이미 없을 때(404) 목록을 다시 불러오라고 호출된다. */
export function useIdeaActions(onSuccess: () => void): UseIdeaActionsResult {
  const [pendingState, setPendingState] = useState<ReadonlySet<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // 같은 틱의 연속 호출은 state 갱신 전이라 ref로 동기 차단한다
  const pendingIds = useRef<Set<string>>(new Set())

  const isPending = useCallback((id: string) => pendingState.has(id), [pendingState])

  /** 처리 중 표시·중복 차단·오류 안내를 공유한다. 실행했으면 true, 중복이라 무시했으면 false. */
  const runAction = useCallback(
    async (id: string, action: IdeaAction, request: () => Promise<unknown>): Promise<boolean> => {
      if (pendingIds.current.has(id)) {
        return false
      }

      pendingIds.current.add(id)
      setPendingState(prev => new Set(prev).add(id))
      setErrorMessage(null)

      try {
        await request()
        onSuccess()
      } catch (error) {
        setErrorMessage(toErrorMessage(error, action))

        if (error instanceof ApiError && error.status === 404) {
          onSuccess()
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
    [onSuccess],
  )

  const changeStatus = useCallback(
    async (id: string, status: IdeaStatus) => {
      await runAction(id, 'changeStatus', () => updateIdea(id, { status }))
    },
    [runAction],
  )

  const remove = useCallback((id: string) => runAction(id, 'remove', () => deleteIdea(id)), [runAction])

  return { isPending, errorMessage, changeStatus, remove }
}
