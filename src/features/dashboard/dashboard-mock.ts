// 퍼블리싱용 임시 데이터. API 연동 시 훅(use-dashboard 등)으로 교체한다.
import type { IdeaStatus } from '../ideas/idea-types';
import type { PostType } from '../posts/post-types';

export interface WeeklyPostCount {
  week: number;
  count: number;
  /** 아직 지나지 않은 주차 */
  isFuture: boolean;
}

/** 게시글 목록 카드에서 쓰는 한 줄 요약. meta는 날짜나 경과일 같은 우측 표시 문구. */
export interface PostSummary {
  id: number;
  title: string;
  type: PostType;
  meta: string;
}

export interface TodoSummaryItem {
  id: number;
  title: string;
  dueLabel: string;
  done: boolean;
}

/** 대시보드 아이디어 카드에서 쓰는 글감 요약. 상태가 doing이면 진행 중으로 표시한다. */
export interface IdeaSummary {
  id: number;
  title: string;
  status: IdeaStatus;
}

export interface IdeaSuggestion {
  id: number;
  title: string;
  summary: string;
  type: PostType;
  reason: string;
}

/** 아이디어 대화의 메시지 한 건. AI 답변에는 제안 카드가 붙을 수 있다. */
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  suggestions?: IdeaSuggestion[];
}

/** 주간 목표 발행 편수. 설정 화면이 생기기 전까지 상수로 둔다. */
export const WEEKLY_POST_GOAL = 2;

export const MOCK_MONTH_LABEL = '2026년 10월';

export const MOCK_WEEKLY_POSTS: WeeklyPostCount[] = [
  { week: 1, count: 3, isFuture: false },
  { week: 2, count: 1, isFuture: false },
  { week: 3, count: 0, isFuture: true },
  { week: 4, count: 0, isFuture: true },
  { week: 5, count: 0, isFuture: true },
];

export const MOCK_RECENT_POSTS: PostSummary[] = [
  { id: 1, title: '포트폴리오 3D 씬 최적화 기록', type: 'PROJECT', meta: '10-08' },
  { id: 2, title: 'GSAP ScrollTrigger 함정 정리', type: 'LAB', meta: '10-05' },
  { id: 3, title: '개발일지 #12 관리자 앱 시작', type: 'DEV_LOG', meta: '10-02' },
];

export const MOCK_STALE_DRAFTS: PostSummary[] = [
  { id: 1, title: 'React 19 use 훅 정리', type: 'DEV_LOG', meta: '42일 전' },
  { id: 2, title: '셰이더 후처리 패스 실험', type: 'LAB', meta: '27일 전' },
  { id: 3, title: 'Neon + Prisma 연동 메모', type: 'DEV_LOG', meta: '14일 전' },
];

export const MOCK_TODOS: TodoSummaryItem[] = [
  { id: 1, title: '대시보드 퍼블리싱', dueLabel: '오늘', done: true },
  { id: 2, title: '백엔드 뼈대 구성', dueLabel: '내일', done: false },
  { id: 3, title: '임시저장 글 정리', dueLabel: '3일 뒤', done: false },
];

// 'doing' 항목을 모두 'todo'로 바꾸면 "진행 중인 아이디어 없음" 상태를 확인할 수 있다
export const MOCK_IDEAS: IdeaSummary[] = [
  { id: 1, title: 'Gemini 무료 티어로 글감 아이디어 제안 기능 붙이기', status: 'doing' },
  { id: 2, title: 'shadcn/ui 사이드바로 관리자 레이아웃 만들기', status: 'todo' },
  { id: 3, title: '주간 발행 목표로 글쓰기 습관 추적하기', status: 'todo' },
  { id: 4, title: 'Neon 서버리스 Postgres 무료 티어 구성', status: 'done' },
];

/** 대화를 요약해 만든 글감 초안. 저장 전에 사용자가 수정할 수 있다. */
export interface IdeaDraft {
  title: string;
  memo: string;
  type: PostType;
}

export const MOCK_IDEA_DRAFT: IdeaDraft = {
  title: 'Gemini 무료 티어로 글감 아이디어 대화 기능 붙이기',
  memo: '- 키는 서버 환경변수에만 둔다\n- 대화 이력은 최근 N개만 보내 무료 한도를 아낀다\n- 429 한도 초과 시 안내 문구를 보여 준다',
  type: 'LAB',
};

export const MOCK_IDEA_SUGGESTIONS: IdeaSuggestion[] = [
  {
    id: 1,
    title: 'Neon 서버리스 Postgres 무료 티어로 관리자 앱 DB 구성하기',
    summary: '풀링/직접 연결 문자열을 나누는 이유와 Prisma 마이그레이션 설정을 정리한다.',
    type: 'DEV_LOG',
    reason: '임시저장 중인 Neon + Prisma 메모를 이어 쓸 수 있어요.',
  },
  {
    id: 2,
    title: 'shadcn/ui 사이드바로 관리자 레이아웃 만들기',
    summary: '접힘 상태 툴팁, 활성 메뉴 표시, 바로가기 그룹까지 구성 과정을 기록한다.',
    type: 'PROJECT',
    reason: '최근 프로젝트 글과 같은 주제 흐름이에요.',
  },
  {
    id: 3,
    title: 'Gemini 무료 티어로 글감 아이디어 제안 기능 붙이기',
    summary: '키를 서버에만 두는 구조와 429 한도 초과 처리 방법을 실험한다.',
    type: 'LAB',
    reason: '아직 다룬 적 없는 AI 연동 주제예요.',
  },
  {
    id: 4,
    title: '주간 발행 목표로 글쓰기 습관 추적하기',
    summary: '주차별 달성률 막대그래프를 직접 그린 과정을 정리한다.',
    type: 'DEV_LOG',
    reason: '이번 달 개발일지와 이어지는 후속 글이에요.',
  },
];
