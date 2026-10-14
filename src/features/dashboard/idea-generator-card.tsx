import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Save, Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MOCK_IDEA_DRAFT, MOCK_IDEA_SUGGESTIONS, type ChatMessage, type IdeaDraft } from './dashboard-mock';
import { IdeaChatMessage } from './idea-chat-message';
import { IdeaSaveDialog } from './idea-save-dialog';

/** 가짜 AI 응답이 도착하기까지의 지연(ms). 실제 API 연동 시 제거한다. */
const MOCK_REPLY_DELAY_MS = 700;

/** AI와 메시지를 주고받으며 글감 아이디어를 만든다. 지금은 가짜 응답으로 동작한다. */
export function IdeaGeneratorCard() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [draft, setDraft] = useState<IdeaDraft | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const nextIdRef = useRef(1);

  // 새 메시지가 생기면 대화 영역만 맨 아래로 스크롤한다
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, isReplying]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const isBusy = isReplying || isSummarizing;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;

    const userMessage: ChatMessage = { id: nextIdRef.current++, role: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSavedTitle(null);
    setIsReplying(true);

    timerRef.current = window.setTimeout(() => {
      const reply: ChatMessage = {
        id: nextIdRef.current++,
        role: 'assistant',
        text: `"${text}" 주제로 이런 글감은 어때요?`,
        suggestions: MOCK_IDEA_SUGGESTIONS.slice(0, 2),
      };
      setMessages(prev => [...prev, reply]);
      setIsReplying(false);
    }, MOCK_REPLY_DELAY_MS);
  };

  // 대화를 요약해 저장 초안을 만든다. 지금은 가짜 요약을 돌려준다.
  const handleRequestSave = () => {
    if (messages.length === 0 || isBusy) return;
    setIsSummarizing(true);

    timerRef.current = window.setTimeout(() => {
      setDraft(MOCK_IDEA_DRAFT);
      setIsSummarizing(false);
    }, MOCK_REPLY_DELAY_MS);
  };

  const handleSaveDraft = (savedDraft: IdeaDraft) => {
    setSavedTitle(savedDraft.title);
    setDraft(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" />
          아이디어 생성
        </CardTitle>
        <CardDescription>주제를 입력하면 AI가 글감을 제안해요. 비워 두면 최근 글 흐름에 맞춰 제안해요.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" disabled={messages.length === 0 || isBusy} onClick={handleRequestSave}>
            <Save />
            {isSummarizing ? '요약하는 중…' : '대화 저장'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={listRef} role="log" aria-live="polite" className="h-96 space-y-3 overflow-y-auto rounded-lg border p-3">
          {messages.length === 0 && (
            <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              AI와 함께 아이디어에 대해 대화를 나누어 보세요
            </p>
          )}
          {messages.map(message => (
            <IdeaChatMessage key={message.id} message={message} />
          ))}
          {isReplying && <p className="animate-pulse text-sm text-muted-foreground">AI가 생각하는 중…</p>}
        </div>
        {savedTitle && <p className="text-sm text-muted-foreground">"{savedTitle}" 글감으로 저장했어요.</p>}
        <form className="flex flex-wrap gap-2" onSubmit={handleSubmit}>
          <Input
            className="min-w-48 flex-1"
            placeholder="메세지를 보내보세요"
            value={input}
            onChange={event => setInput(event.target.value)}
          />
          <Button type="submit" disabled={isBusy || input.trim() === ''}>
            보내기
            <Send />
          </Button>
        </form>
      </CardContent>
      {draft && <IdeaSaveDialog draft={draft} onClose={() => setDraft(null)} onSave={handleSaveDraft} />}
    </Card>
  );
}
