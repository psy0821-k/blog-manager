import { useCallback, useRef, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import { updateIdea } from './ideas-api'
import type { SavedIdea, UpdateIdeaInput } from './ideas-api'
import { toSaveErrorMessage } from './use-save-idea'

const NOT_FOUND_MESSAGE = '이미 삭제된 글감입니다'

export interface UseUpdateIdeaResult {
  /** 수정 요청이 진행 중인지 */
  isSaving: boolean
  /** 마지막 수정 실패 안내. 없으면 null. 다음 update를 시작하거나 resetError를 부르면 지워진다. */
  errorMessage: string | null
  /** 글감을 고치고 서버가 돌려준 글감을 반환한다. 이미 저장 중이라 무시했거나 실패하면 null. 거부하지 않는다. */
  update: (id: string, input: UpdateIdeaInput) => Promise<SavedIdea | null>
  /** 실패 안내를 지운다. 수정 다이얼로그를 열고 닫을 때 부른다. */
  resetError: () => void
}

function toErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.status === 404 ? NOT_FOUND_MESSAGE : toSaveErrorMessage(error)
}

export function useUpdateIdea(): UseUpdateIdeaResult {
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // 같은 틱의 연속 호출은 state 갱신 전이라 ref로 동기 차단한다
  const savingRef = useRef(false)

  const update = useCallback(async (id: string, input: UpdateIdeaInput): Promise<SavedIdea | null> => {
    if (savingRef.current) {
      return null
    }

    savingRef.current = true
    setIsSaving(true)
    setErrorMessage(null)

    try {
      return await updateIdea(id, input)
    } catch (error) {
      setErrorMessage(toErrorMessage(error))
      return null
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }, [])

  const resetError = useCallback(() => setErrorMessage(null), [])

  return { isSaving, errorMessage, update, resetError }
}
