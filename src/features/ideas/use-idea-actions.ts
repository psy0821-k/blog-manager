import { useCallback, useRef, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import type { IdeaStatus } from './idea-types'
import { updateIdea } from './ideas-api'

const NOT_FOUND_MESSAGE = '이미 삭제된 글감입니다'
const NETWORK_MESSAGE = '네트워크 오류로 상태를 바꾸지 못했습니다.'

export interface UseIdeaActionsResult {
  /** 해당 글감(id)의 변경 요청이 진행 중인지 */
  isPending: (id: string) => boolean
  /** 마지막 변경 실패 안내. 없으면 null. 다음 요청을 시작하면 지워진다. */
  errorMessage: string | null
  /** 글감의 상태를 바꾼다. 같은 글감이 처리 중이면 무시하고, 실패해도 거부하지 않는다. */
  changeStatus: (id: string, status: IdeaStatus) => Promise<void>
}

function toErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return NETWORK_MESSAGE
  }

  return error.status === 404 ? NOT_FOUND_MESSAGE : `상태를 바꾸지 못했습니다. (${error.status})`
}

/** onSuccess는 요청이 성공했거나 글감이 이미 없을 때(404) 목록을 다시 불러오라고 호출된다. */
export function useIdeaActions(onSuccess: () => void): UseIdeaActionsResult {
  const [pendingState, setPendingState] = useState<ReadonlySet<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // 같은 틱의 연속 호출은 state 갱신 전이라 ref로 동기 차단한다
  const pendingIds = useRef<Set<string>>(new Set())

  const isPending = useCallback((id: string) => pendingState.has(id), [pendingState])

  const changeStatus = useCallback(
    async (id: string, status: IdeaStatus) => {
      if (pendingIds.current.has(id)) {
        return
      }

      pendingIds.current.add(id)
      setPendingState(prev => new Set(prev).add(id))
      setErrorMessage(null)

      try {
        await updateIdea(id, { status })
        onSuccess()
      } catch (error) {
        setErrorMessage(toErrorMessage(error))

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
    },
    [onSuccess],
  )

  return { isPending, errorMessage, changeStatus }
}
