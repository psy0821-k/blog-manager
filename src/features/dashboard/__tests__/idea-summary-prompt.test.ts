import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDEA_MEMO_MAX_LENGTH, IDEA_TITLE_MAX_LENGTH } from '../../ideas/idea-types';
import { summarizeIdeaDraft } from '../api/idea-ai-api';
import type { ChatMessage } from '../dashboard-mock';

const fetchMock = vi.fn();

const HISTORY: ChatMessage[] = [{ id: 1, role: 'user', text: 'React 19' }];

function geminiResponse(payload: unknown) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }));
}

/** 요약 요청의 systemInstruction 텍스트 */
async function readSummaryInstruction(): Promise<string> {
  fetchMock.mockImplementation(async () => geminiResponse({ title: '제목', memo: '- 메모', type: 'LAB' }));

  await summarizeIdeaDraft(HISTORY);

  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(init.body).systemInstruction.parts[0].text;
}

describe('summarizeIdeaDraft 프롬프트 글자 수 한도', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('요약 요청의 systemInstruction에 제목 100자·메모 2000자 이내라는 한도 문구가 있어야 한다', async () => {
    const instruction = await readSummaryInstruction();

    expect(instruction).toContain('100자 이내');
    expect(instruction).toContain('2000자 이내');
  });

  it('문구의 글자 수가 IDEA_TITLE_MAX_LENGTH, IDEA_MEMO_MAX_LENGTH와 같아야 한다', async () => {
    const instruction = await readSummaryInstruction();

    expect(instruction).toContain(`${IDEA_TITLE_MAX_LENGTH}자 이내`);
    expect(instruction).toContain(`${IDEA_MEMO_MAX_LENGTH}자 이내`);
  });
});
