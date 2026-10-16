import { createBrowserRouter } from 'react-router-dom'
import { ComingSoonPage } from './components/coming-soon-page'
import { NotFoundPage } from './components/not-found-page'
import { DashboardPage } from './features/dashboard/dashboard-page'
import { AuthCallbackPage } from './features/auth/auth-callback-page'
import { LoginPage } from './features/auth/login-page'
import { RequireAuth } from './features/auth/require-auth'
import { PostListPage } from './features/posts/post-list-page'
import { AppLayout } from './layouts/app-layout'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/todo', element: <ComingSoonPage title="오늘 할 일" /> },
          { path: '/reference', element: <ComingSoonPage title="사이트 모음" /> },
          { path: '/ideas', element: <ComingSoonPage title="글감 아이디어" /> },
          { path: '/manage', element: <PostListPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
