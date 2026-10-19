import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { IDEA_MEMO_MAX_LENGTH, IDEA_TITLE_MAX_LENGTH } from '../ideas/idea-types';
import { POST_TYPES, POST_TYPE_LABELS } from '../posts/post-types';
import type { IdeaDraft } from './dashboard-mock';

interface IdeaSaveDialogProps {
  draft: IdeaDraft;
  /** 저장 요청이 진행 중이면 저장 버튼을 비활성화하고 "저장 중…"을 보여 준다. */
  isSaving: boolean;
  /** 저장 실패 안내. 있으면 저장 버튼 위쪽에 알림으로 보여 준다. 입력값은 그대로 둔다. */
  errorMessage: string | null;
  onClose: () => void;
  onSave: (draft: IdeaDraft) => void;
}

/** 대화 요약 초안을 확인하고 수정한 뒤 글감으로 저장한다. 열릴 때마다 새로 마운트해 입력값을 초기화한다. */
export function IdeaSaveDialog({ draft, isSaving, errorMessage, onClose, onSave }: IdeaSaveDialogProps) {
  const [title, setTitle] = useState(draft.title);
  const [memo, setMemo] = useState(draft.memo);
  const [type, setType] = useState(draft.type);

  const canSave = title.trim() !== '';

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>대화 내용을 글감으로 저장</DialogTitle>
          <DialogDescription>AI가 요약한 내용이에요. 저장하기 전에 수정할 수 있어요.</DialogDescription>
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
            {POST_TYPES.map(postType => (
              <Button
                key={postType}
                size="sm"
                variant={type === postType ? 'default' : 'outline'}
                onClick={() => setType(postType)}
              >
                {POST_TYPE_LABELS[postType]}
              </Button>
            ))}
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
      </DialogContent>
    </Dialog>
  );
}
