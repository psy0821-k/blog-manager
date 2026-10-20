import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoaderCircle } from 'lucide-react'

const PENDING_LABEL = '삭제 중…'

interface ConfirmDeleteDialogProps {
  /** 삭제 대상 글 제목. null이면 대화상자를 닫는다. */
  title: string | null
  /** 대화상자 제목. 생략하면 '글 삭제'. */
  heading?: string
  /** 삭제 요청이 진행 중인지. true이면 삭제/취소를 비활성화하고 닫히지 않는다. */
  isPending: boolean
  onConfirm: () => void
  /** 취소 버튼·Esc·바깥 클릭으로 닫으려 할 때(처리 중에는 호출되지 않는다) */
  onCancel: () => void
}

export function ConfirmDeleteDialog({ title, heading = '글 삭제', isPending, onConfirm, onCancel }: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={title !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onCancel()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{`「${title}」을 삭제할까요? 되돌릴 수 없습니다.`}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {isPending && <LoaderCircle role="status" aria-label="삭제 중" className="size-5 animate-spin self-center text-muted-foreground" />}
          <Button variant="outline" disabled={isPending} onClick={onCancel}>
            취소
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? PENDING_LABEL : '삭제'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
