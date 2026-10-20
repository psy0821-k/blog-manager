import { useCallback, useRef, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import { createIdea } from './ideas-api'
import type { NewIdeaInput, SavedIdea } from './ideas-api'

const INVALID_INPUT_MESSAGE = '입력한 내용을 저장할 수 없어요. 제목과 메모를 확인해 주세요.'
const AUTH_MESSAGE = '로그인이 만료됐거나 권한이 없어요. 다시 로그인해 주세요.'
const NETWORK_MESSAGE = '서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'

export interface UseSaveIdeaResult {
  /** 저장 요청이 진행 중인지 */
  isSaving: boolean
  /** 마지막 저장 실패 안내. 없으면 null. 다음 save를 시작하거나 resetError를 부르면 지워진다. */
  errorMessage: string | null
  /** 저장하고 서버가 돌려준 글감을 반환한다. 이미 저장 중이라 무시했거나 실패하면 null. 거부하지 않는다. */
  save: (input: NewIdeaInput) => Promise<SavedIdea | null>
  /** 실패 안내를 지운다. 다이얼로그를 닫을 때 부른다. */
  resetError: () => void
}

// ApiError는 응답 본문을 담지 않으므로 상태 코드만 안내에 쓴다. ApiError가 아니면 서버에 닿지 못한 것으로 본다
export function toSaveErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return NETWORK_MESSAGE
  }

  if (error.status === 400) {
    return INVALID_INPUT_MESSAGE
  }

  if (error.status === 401 || error.status === 403) {
    return AUTH_MESSAGE
  }

  return `서버 오류로 저장하지 못했어요. 잠시 후 다시 시도해 주세요. (${error.status})`
}

export function useSaveIdea(): UseSaveIdeaResult {
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // 같은 틱의 연속 호출은 state 갱신 전이라 ref로 동기 차단한다
  const savingRef = useRef(false)

  const save = useCallback(async (input: NewIdeaInput): Promise<SavedIdea | null> => {
    if (savingRef.current) {
      return null
    }

    savingRef.current = true
    setIsSaving(true)
    setErrorMessage(null)

    try {
      return await createIdea(input)
    } catch (error) {
      setErrorMessage(toSaveErrorMessage(error))
      return null
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }, [])

  const resetError = useCallback(() => setErrorMessage(null), [])

  return { isSaving, errorMessage, save, resetError }
}
