import { useEffect, useRef } from 'react'
import { redirectToBlogLogin } from '@/lib/auth-redirect'

/** 화면 없이 블로그 로그인으로 보낸다. */
export function LoginPage() {
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (hasRedirected.current) {
      return
    }

    hasRedirected.current = true
    redirectToBlogLogin('/')
  }, [])

  return null
}
