import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Save, Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { generateIdeaReply, IdeaAiError, summarizeIdeaDraft } from './api/idea-ai-api';
import type { ChatMessage, IdeaDraft } from './dashboard-mock';
import { IdeaChatMessage } from './idea-chat-message';
import { IdeaSaveDialog } from './idea-save-dialog';

const RATE_LIMIT_MESSAGE = 'AI 사용 한도를 넘었어요. 잠시 후 다시 시도해 주세요.';
const GENERIC_ERROR_MESSAGE = 'AI 응답을 받지 못했어요. 다시 시도해 주세요.';

function toErrorMessage(error: unknown): string {
  return error instanceof IdeaAiError && error.status === 429 ? RATE_LIMIT_MESSAGE : GENERIC_ERROR_MESSAGE;
}

/** AI와 메시지를 주고받으며 글감 아이디어를 만든다. */
export function IdeaGeneratorCard() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [draft, setDraft] = useState<IdeaDraft | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextIdRef = useRef(1);

  // 새 메시지가 생기면 대화 영역만 맨 아래로 스크롤한다
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, isReplying]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const isBusy = isReplying || isSummarizing;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;

    const userMessage: ChatMessage = { id: nextIdRef.current++, role: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSavedTitle(null);
    setErrorMessage(null);
    setIsReplying(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { text: replyText, suggestions } = await generateIdeaReply([...messages, userMessage], controller.signal);
      const reply: ChatMessage = {
        id: nextIdRef.current++,
        role: 'assistant',
        text: replyText,
        suggestions: suggestions.map(suggestion => ({ ...suggestion, id: nextIdRef.current++ })),
      };
      setMessages(prev => [...prev, reply]);
    } catch (error) {
      if (controller.signal.aborted) return;
      setErrorMessage(toErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setIsReplying(false);
    }
  };

  // 대화를 요약해 저장 초안을 만든다
  const handleRequestSave = async () => {
    if (messages.length === 0 || isBusy) return;
    setErrorMessage(null);
    setIsSummarizing(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setDraft(await summarizeIdeaDraft(messages, controller.signal));
    } catch (error) {
      if (controller.signal.aborted) return;
      setErrorMessage(toErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setIsSummarizing(false);
    }
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
        {errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
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
