import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateIdeaReply, IdeaAiError, summarizeIdeaDraft } from '../api/idea-ai-api';
import type { ChatMessage } from '../dashboard-mock';

const fetchMock = vi.fn();

function geminiResponse(payload: unknown) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }));
}

const history: ChatMessage[] = [{ id: 1, role: 'user', text: 'React 19' }];

describe('idea-ai-api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('대화 이력을 role 매핑해 /ai/generate로 보내고 답변을 파싱한다', async () => {
    const reply = { text: '이런 글감은 어때요?', suggestions: [] };
    fetchMock.mockImplementation(async () => geminiResponse(reply));

    const messages: ChatMessage[] = [...history, { id: 2, role: 'assistant', text: '안녕' }, { id: 3, role: 'user', text: '더' }];
    await expect(generateIdeaReply(messages)).resolves.toEqual(reply);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/ai/generate');
    const body = JSON.parse(init.body);
    expect(body.contents.map((content: { role: string }) => content.role)).toEqual(['user', 'model', 'user']);
    expect(init.headers).not.toHaveProperty('x-goog-api-key');
  });

  it('최근 10개 메시지만 보낸다', async () => {
    fetchMock.mockImplementation(async () => geminiResponse({ text: '', suggestions: [] }));
    const many: ChatMessage[] = Array.from({ length: 15 }, (_, index) => ({ id: index, role: 'user', text: `m${index}` }));

    await generateIdeaReply(many);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).contents).toHaveLength(10);
  });

  it('요약은 마지막 턴을 사용자 요청으로 끝낸다', async () => {
    const draft = { title: '제목', memo: '- 메모', type: 'LAB' };
    fetchMock.mockImplementation(async () => geminiResponse(draft));

    await expect(summarizeIdeaDraft([...history, { id: 2, role: 'assistant', text: '답' }])).resolves.toEqual(draft);

    const { contents } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(contents.at(-1).role).toBe('user');
  });

  it('429 응답이면 상태 코드를 담은 IdeaAiError를 던진다', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 429 }));

    await expect(generateIdeaReply(history)).rejects.toMatchObject({ name: IdeaAiError.name, status: 429 });
  });

  it('응답 본문이 비어 있으면 오류를 던진다', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ candidates: [] })));

    await expect(generateIdeaReply(history)).rejects.toBeInstanceOf(IdeaAiError);
  });
});
