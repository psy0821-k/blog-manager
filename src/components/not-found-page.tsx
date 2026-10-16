import { Link } from 'react-router-dom'

/** 등록되지 않은 경로로 들어왔을 때 보여주는 안내 화면. */
export function NotFoundPage() {
  return (
    <section style={{ padding: '24px 16px' }}>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>
        <Link to="/">대시보드로 돌아가기</Link>
      </p>
    </section>
  )
}
