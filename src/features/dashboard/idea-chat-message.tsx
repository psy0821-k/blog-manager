import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { POST_TYPE_LABELS } from '../posts/post-types';
import type { ChatMessage } from './dashboard-mock';

interface IdeaChatMessageProps {
  message: ChatMessage;
}

/** 대화 말풍선. 사용자는 오른쪽, AI는 왼쪽에 표시하고 AI 답변에는 제안 카드가 붙을 수 있다. */
export function IdeaChatMessage({ message }: IdeaChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
        {message.text}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Sparkles className="size-4" />
      </span>
      <div className="max-w-[85%] space-y-2">
        <p className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm">{message.text}</p>
        {message.suggestions?.map(suggestion => (
          <div key={suggestion.id} className="space-y-2 rounded-lg border bg-background p-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{POST_TYPE_LABELS[suggestion.type]}</Badge>
              <span className="text-sm font-medium">{suggestion.title}</span>
            </div>
            <p className="text-sm text-muted-foreground">{suggestion.summary}</p>
            <p className="text-xs text-muted-foreground">💡 {suggestion.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
