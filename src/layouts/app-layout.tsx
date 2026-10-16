import { redirectToBlogLogout } from '@/lib/auth-redirect';
import { clearToken } from '@/lib/auth-token';
import SideNav from './side-nav/side-nav';

/** 토큰에는 이름이 없어 로그인 사용자를 이 이름으로 표시한다 */
const ADMIN_DISPLAY_NAME = '관리자';

export function AppLayout() {
  const handleLogout = () => {
    clearToken();
    // 블로그 세션까지 지워야 다시 들어올 때 바로 재로그인되지 않는다
    redirectToBlogLogout();
  };

  return (
    <div>
      <SideNav user={ADMIN_DISPLAY_NAME} onLogout={handleLogout} />
    </div>
  );
}
