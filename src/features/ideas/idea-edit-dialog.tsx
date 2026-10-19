import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { PostType } from '../posts/post-types'
import { IdeaTypeButtons } from './idea-type-buttons'
import { IDEA_MEMO_MAX_LENGTH, IDEA_TITLE_MAX_LENGTH } from './idea-types'
import type { SavedIdea } from './ideas-api'

/** 수정 다이얼로그가 저장할 때 넘기는 값 */
export interface IdeaEditInput {
  title: string
  memo: string
  type: PostType
}

interface IdeaEditDialogProps {
  /** null이면 닫힌다. */
  idea: SavedIdea | null
  /** 저장 요청이 진행 중이면 저장 버튼을 비활성화하고 "저장 중…"을 보여 준다. */
  isSaving: boolean
  /** 저장 실패 안내. 있으면 버튼 위에 알림으로 보여 준다. 입력값은 그대로 둔다. */
  errorMessage: string | null
  onClose: () => void
  onSave: (input: IdeaEditInput) => void
}

interface EditFormProps extends Omit<IdeaEditDialogProps, 'idea'> {
  idea: SavedIdea
}

function EditForm({ idea, isSaving, errorMessage, onClose, onSave }: EditFormProps) {
  const [title, setTitle] = useState(idea.title)
  const [memo, setMemo] = useState(idea.memo)
  const [type, setType] = useState<PostType>(idea.type)

  const canSave = title.trim() !== ''

  return (
    <>
      <DialogHeader>
        <DialogTitle>글감 수정</DialogTitle>
        <DialogDescription>제목, 메모, 종류를 고칠 수 있어요.</DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <Input
          value={title}
          maxLength={IDEA_TITLE_MAX_LENGTH}
          onChange={event => setTitle(event.target.value)}
          placeholder="제목"
        />
        <Textarea
          className="min-h-32"
          value={memo}
          maxLength={IDEA_MEMO_MAX_LENGTH}
          onChange={event => setMemo(event.target.value)}
          placeholder="메모"
        />
        <div className="flex gap-2">
          <IdeaTypeButtons value={type} onChange={setType} />
        </div>
        {errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button disabled={!canSave || isSaving} onClick={() => onSave({ title: title.trim(), memo, type })}>
          {isSaving ? '저장 중…' : '저장'}
        </Button>
      </DialogFooter>
    </>
  )
}

/** 글감의 제목·메모·종류를 고친다. 다른 글감으로 열리면 폼을 새로 마운트해 입력값을 그 글감 기준으로 초기화한다. */
export function IdeaEditDialog({ idea, ...formProps }: IdeaEditDialogProps) {
  return (
    <Dialog open={idea !== null} onOpenChange={open => !open && formProps.onClose()}>
      <DialogContent>{idea && <EditForm key={idea.id} idea={idea} {...formProps} />}</DialogContent>
    </Dialog>
  )
}
