import { useState } from 'react'
import { clearToken, getToken, isTokenExpired, saveToken } from '../../lib/auth-token'

/**
 * 개발용: 블로그에서 발급한 JWT를 직접 붙여넣어 sessionStorage에 저장한다.
 * 블로그의 로그인 리디렉션 페이지가 준비되면 이 화면과 라우트를 제거한다.
 */
export function DevTokenPage() {
  const [tokenInput, setTokenInput] = useState('')
  const [hasToken, setHasToken] = useState(() => getToken() !== null)
  const [message, setMessage] = useState('')

  const handleSave = () => {
    const token = tokenInput.trim()

    if (!token || isTokenExpired(token)) {
      setMessage('유효하지 않거나 만료된 토큰입니다.')
      return
    }

    saveToken(token)
    setTokenInput('')
    setHasToken(true)
    setMessage('토큰을 저장했습니다.')
  }

  const handleClear = () => {
    clearToken()
    setHasToken(false)
    setMessage('토큰을 삭제했습니다.')
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <h1>개발용 토큰</h1>
      <p>현재 상태: {hasToken ? '토큰 저장됨' : '토큰 없음'}</p>
      <textarea
        rows={5}
        style={{ width: '100%' }}
        placeholder="JWT를 붙여넣으세요"
        value={tokenInput}
        onChange={(event) => setTokenInput(event.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={handleSave}>
          저장
        </button>
        <button type="button" onClick={handleClear}>
          삭제
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </main>
  )
}
