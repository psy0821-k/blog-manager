import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { redirectToBlogLogin } from '@/lib/auth-redirect'
import { getLoginErrorMessage } from './login-error-message'

/**
 * 평소에는 화면 없이 블로그 로그인으로 보낸다.
 * 오류(?error=)가 있으면 이유를 안내하고, 로그아웃 직후(?loggedOut=1)에는 자동 이동하지 않고 버튼으로만 다시 로그인한다.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams()
  const isLoggedOut = searchParams.get('loggedOut') === '1'
  const errorMessage = getLoginErrorMessage(searchParams.get('error'))
  const shouldStay = errorMessage !== null || isLoggedOut
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (shouldStay || hasRedirected.current) {
      return
    }

    hasRedirected.current = true
    redirectToBlogLogin('/')
  }, [shouldStay])

  if (!shouldStay) {
    return null
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4">
      <p>{errorMessage ?? '로그아웃되었습니다.'}</p>
      <Button type="button" onClick={() => redirectToBlogLogin('/')}>
        다시 로그인
      </Button>
    </main>
  )
}
