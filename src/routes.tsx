import { createBrowserRouter } from 'react-router-dom'
import { ComingSoonPage } from './components/coming-soon-page'
import { DashboardPage } from './features/dashboard/dashboard-page'
import { DevTokenPage } from './features/auth/dev-token-page'
import { PostListPage } from './features/posts/post-list-page'
import { AppLayout } from './layouts/app-layout'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/todo', element: <ComingSoonPage title="오늘 할 일" /> },
      { path: '/reference', element: <ComingSoonPage title="사이트 모음" /> },
      { path: '/ideas', element: <ComingSoonPage title="글감 아이디어" /> },
      { path: '/manage', element: <PostListPage /> },
    ],
  },
  // 개발용 토큰 입력 화면은 개발 모드에서만 노출한다
  ...(import.meta.env.DEV ? [{ path: '/dev-token', element: <DevTokenPage /> }] : []),
])
