import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readTokenFromHash, takeReturnPath } from '@/lib/auth-redirect'
import { isTokenExpired, saveToken } from '@/lib/auth-token'

/** 블로그가 해시로 넘긴 토큰을 저장하고 원래 화면으로 돌려보낸다. */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const hasHandled = useRef(false)
  const [isInvalid, setIsInvalid] = useState(false)

  useEffect(() => {
    if (hasHandled.current) {
      return
    }

    hasHandled.current = true
    const token = readTokenFromHash(window.location.hash)

    if (!token || isTokenExpired(token)) {
      setIsInvalid(true)
      return
    }

    saveToken(token)
    // 주소창에 토큰이 남지 않도록 해시를 제거한다
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    navigate(takeReturnPath(), { replace: true })
  }, [navigate])

  return isInvalid ? <p>로그인 정보를 확인할 수 없습니다.</p> : null
}
