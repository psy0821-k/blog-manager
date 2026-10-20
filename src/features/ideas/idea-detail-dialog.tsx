import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { POST_TYPE_LABELS } from '../posts/post-types'
import { IDEA_STATUS_LABELS } from './idea-types'
import type { SavedIdea } from './ideas-api'

interface IdeaDetailDialogProps {
  /** null이면 닫힌다. */
  idea: SavedIdea | null
  onClose: () => void
  /** 있으면 "수정" 버튼을 보여 주고 누르면 이 글감으로 호출한다. */
  onEdit?: (idea: SavedIdea) => void
  /** 있으면 "삭제" 버튼을 보여 주고 누르면 이 글감으로 호출한다. */
  onDelete?: (idea: SavedIdea) => void
}

export function IdeaDetailDialog({ idea, onClose, onEdit, onDelete }: IdeaDetailDialogProps) {
  return (
    <Dialog open={idea !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        {idea && (
          <>
            <DialogHeader>
              <DialogTitle>{idea.title}</DialogTitle>
              <DialogDescription className="sr-only">글감 상세</DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">종류</dt>
              <dd>{POST_TYPE_LABELS[idea.type]}</dd>
              <dt className="text-muted-foreground">상태</dt>
              <dd>{IDEA_STATUS_LABELS[idea.status]}</dd>
              <dt className="text-muted-foreground">등록일</dt>
              <dd>{new Date(idea.createdAt).toLocaleDateString('ko-KR')}</dd>
            </dl>

            {idea.memo ? (
              <p className="whitespace-pre-wrap text-sm">{idea.memo}</p>
            ) : (
              <p className="text-sm text-muted-foreground">메모가 없습니다.</p>
            )}

            <DialogFooter>
              {onDelete && (
                <Button variant="destructive" onClick={() => onDelete(idea)}>
                  삭제
                </Button>
              )}
              {onEdit && <Button onClick={() => onEdit(idea)}>수정</Button>}
              <DialogClose asChild>
                <Button variant="outline">닫기</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
