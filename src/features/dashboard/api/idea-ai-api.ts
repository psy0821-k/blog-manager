import { IDEA_MEMO_MAX_LENGTH, IDEA_TITLE_MAX_LENGTH } from '../../ideas/idea-types';
import { POST_TYPES } from '../../posts/post-types';
import type { ChatMessage, IdeaDraft, IdeaSuggestion } from '../dashboard-mock';

/** 개발 서버가 Gemini generateContent로 중계하는 경로. 키는 서버가 붙인다(vite.config.ts). */
const AI_ENDPOINT = '/ai/generate';

/** 무료 한도를 아끼려고 최근 메시지만 보낸다. */
const MAX_HISTORY_MESSAGES = 10;

const REPLY_INSTRUCTION =
  '당신은 개인 개발 블로그의 글감을 제안하는 도우미다. 한국어로 답한다. ' +
  '사용자의 주제에 맞는 글감을 1~3개 제안하고, 종류는 PROJECT, LAB, DEV_LOG 중 하나로 고른다. ' +
  'text에는 짧은 안내 문장을 쓴다.';

// 저장 한도(서버 검증, 입력창 maxLength)를 넘지 않도록 초안 단계에서 글자 수를 알린다
const SUMMARY_INSTRUCTION =
  '지금까지의 대화를 바탕으로 저장할 글감 하나를 정리한다. 한국어로 답한다. ' +
  `title은 한 줄 제목(${IDEA_TITLE_MAX_LENGTH}자 이내), ` +
  `memo는 "- "로 시작하는 핵심 메모 목록(줄바꿈 구분, ${IDEA_MEMO_MAX_LENGTH}자 이내), ` +
  'type은 PROJECT, LAB, DEV_LOG 중 하나다.';

const SUMMARY_REQUEST = '위 대화를 글감 하나로 정리해 주세요.';

const POST_TYPE_SCHEMA = { type: 'STRING', enum: [...POST_TYPES] };

const SUGGESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    type: POST_TYPE_SCHEMA,
    reason: { type: 'STRING' },
  },
  required: ['title', 'summary', 'type', 'reason'],
};

const REPLY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    text: { type: 'STRING' },
    suggestions: { type: 'ARRAY', items: SUGGESTION_SCHEMA },
  },
  required: ['text', 'suggestions'],
};

const DRAFT_SCHEMA = {
  type: 'OBJECT',
  properties: { title: { type: 'STRING' }, memo: { type: 'STRING' }, type: POST_TYPE_SCHEMA },
  required: ['title', 'memo', 'type'],
};

export interface IdeaReply {
  text: string;
  suggestions: Omit<IdeaSuggestion, 'id'>[];
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export class IdeaAiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'IdeaAiError';
    this.status = status;
  }
}

function toContents(messages: ChatMessage[]) {
  return messages.slice(-MAX_HISTORY_MESSAGES).map(({ role, text }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text }],
  }));
}

async function generateJson<T>(
  messages: ChatMessage[],
  instruction: string,
  schema: object,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instruction }] },
      contents: toContents(messages),
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
    }),
  });

  if (!response.ok) {
    throw new IdeaAiError(response.status, `AI 요청에 실패했습니다. (${response.status})`);
  }

  const body: GeminiResponse = await response.json();
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new IdeaAiError(502, 'AI 응답이 비어 있습니다.');

  return JSON.parse(text) as T;
}

/** 대화 이력을 보내 AI 답변과 글감 제안을 받는다. */
export function generateIdeaReply(messages: ChatMessage[], signal?: AbortSignal): Promise<IdeaReply> {
  return generateJson<IdeaReply>(messages, REPLY_INSTRUCTION, REPLY_SCHEMA, signal);
}

/** 대화 이력을 요약해 저장용 글감 초안을 받는다. */
export function summarizeIdeaDraft(messages: ChatMessage[], signal?: AbortSignal): Promise<IdeaDraft> {
  // 마지막 턴이 사용자여야 하므로 요약 요청을 덧붙인다
  const request: ChatMessage = { id: 0, role: 'user', text: SUMMARY_REQUEST };
  return generateJson<IdeaDraft>([...messages, request], SUMMARY_INSTRUCTION, DRAFT_SCHEMA, signal);
}
