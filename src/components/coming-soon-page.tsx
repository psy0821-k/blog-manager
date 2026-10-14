interface ComingSoonPageProps {
  title: string
}

/** 아직 구현하지 않은 메뉴의 자리표시 화면. */
export function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <section style={{ padding: '24px 16px' }}>
      <h1>{title}</h1>
      <p>준비 중입니다.</p>
    </section>
  )
}
