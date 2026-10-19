import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PostType } from '../posts/post-types'
import { IdeaTypeButtons } from './idea-type-buttons'
import { IDEA_TITLE_MAX_LENGTH } from './idea-types'
import type { NewIdeaInput, SavedIdea } from './ideas-api'

const DEFAULT_TYPE: PostType = 'DEV_LOG'

interface IdeaQuickAddProps {
  isSaving: boolean
  /** 추가 실패 안내. 있으면 입력 아래에 알림으로 보여 준다. 입력값은 그대로 둔다. */
  errorMessage: string | null
  /** 추가에 성공하면 글감을, 실패하거나 무시되면 null을 돌려준다. */
  onAdd: (input: NewIdeaInput) => Promise<SavedIdea | null>
}

/** 제목과 종류만 입력해 글감을 바로 추가한다. */
export function IdeaQuickAdd({ isSaving, errorMessage, onAdd }: IdeaQuickAddProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<PostType>(DEFAULT_TYPE)

  const canAdd = title.trim() !== '' && !isSaving

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!canAdd) return

    const added = await onAdd({ title: title.trim(), memo: '', type })

    if (added) setTitle('')
  }

  return (
    <form className="space-y-2" onSubmit={event => void handleSubmit(event)}>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-48 flex-1"
          value={title}
          maxLength={IDEA_TITLE_MAX_LENGTH}
          onChange={event => setTitle(event.target.value)}
          placeholder="제목"
        />
        <div className="flex gap-1">
          <IdeaTypeButtons value={type} onChange={setType} />
        </div>
        <Button type="submit" disabled={!canAdd}>
          {isSaving ? '추가 중…' : '추가'}
        </Button>
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </form>
  )
}
