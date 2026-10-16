import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { redirectToBlogLogin } from '@/lib/auth-redirect'
import { getToken } from '@/lib/auth-token'

/** 토큰이 없으면 아무것도 그리지 않고 블로그 로그인으로 보낸다. */
export function RequireAuth() {
  const location = useLocation()
  const hasToken = getToken() !== null
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (hasToken || hasRedirected.current) {
      return
    }

    hasRedirected.current = true
    redirectToBlogLogin(location.pathname + location.search)
  }, [hasToken, location.pathname, location.search])

  return hasToken ? <Outlet /> : null
}
