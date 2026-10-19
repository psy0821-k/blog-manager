import { useCallback, useRef, useState } from 'react'
import { createIdea } from './ideas-api'
import type { NewIdeaInput, SavedIdea } from './ideas-api'

export interface UseSaveIdeaResult {
  /** 저장 요청이 진행 중인지 */
  isSaving: boolean
  /** 저장하고 서버가 돌려준 글감을 반환한다. 이미 저장 중이라 무시했거나 실패하면 null. 거부하지 않는다. */
  save: (input: NewIdeaInput) => Promise<SavedIdea | null>
}

export function useSaveIdea(): UseSaveIdeaResult {
  const [isSaving, setIsSaving] = useState(false)
  // 같은 틱의 연속 호출은 state 갱신 전이라 ref로 동기 차단한다
  const savingRef = useRef(false)

  const save = useCallback(async (input: NewIdeaInput): Promise<SavedIdea | null> => {
    if (savingRef.current) {
      return null
    }

    savingRef.current = true
    setIsSaving(true)

    try {
      return await createIdea(input)
    } catch {
      // 실패 안내는 별도 이슈(#36)에서 다룬다
      return null
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }, [])

  return { isSaving, save }
}
