import { FileText, LayoutDashboard, Lightbulb, Link2, ListTodo, type LucideIcon } from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '대시보드', icon: LayoutDashboard },
  { path: '/todo', label: '오늘 할 일', icon: ListTodo },
  { path: '/reference', label: '사이트 모음', icon: Link2 },
  { path: '/ideas', label: '글감 아이디어', icon: Lightbulb },
  { path: '/manage', label: '컨텐츠 관리', icon: FileText },
];
