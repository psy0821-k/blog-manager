import { Bot, GitBranch, LampDesk, type LucideIcon, Play, Sparkles, Triangle } from 'lucide-react';

export interface QuickLink {
  url: string;
  label: string;
  icon: LucideIcon;
}

// 자주 쓰는 사이트. Claude는 프롬프트로 직접 사용하므로 제외한다.
export const QUICK_LINKS: QuickLink[] = [
  { url: 'https://www.youtube.com', label: '유튜브', icon: Play },
  { url: 'https://chatgpt.com', label: 'ChatGPT', icon: Bot },
  { url: 'https://gemini.google.com', label: 'Gemini', icon: Sparkles },
  { url: 'https://github.com', label: 'GitHub', icon: GitBranch },
  { url: 'https://vercel.com', label: 'Vercel', icon: Triangle },
  { url: 'https://blog-project-mu-six.vercel.app/', label: '블로그', icon: LampDesk },
];
