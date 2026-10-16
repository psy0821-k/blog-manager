import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { redirectToBlogLogin } from '@/lib/auth-redirect'

/** 로그아웃 직후에는 자동 이동하지 않고 버튼으로만 다시 로그인한다(바로 재로그인되는 것을 막는다). */
export const LOGGED_OUT_QUERY = 'loggedOut=1'

/** 평소에는 화면 없이 블로그 로그인으로 보낸다. */
export function LoginPage() {
  const [searchParams] = useSearchParams()
  const isLoggedOut = searchParams.get('loggedOut') === '1'
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (isLoggedOut || hasRedirected.current) {
      return
    }

    hasRedirected.current = true
    redirectToBlogLogin('/')
  }, [isLoggedOut])

  if (!isLoggedOut) {
    return null
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4">
      <p>로그아웃되었습니다.</p>
      <Button type="button" onClick={() => redirectToBlogLogin('/')}>
        다시 로그인
      </Button>
    </main>
  )
}
