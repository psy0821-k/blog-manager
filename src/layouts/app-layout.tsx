import { useNavigate } from 'react-router-dom';
import { LOGGED_OUT_QUERY } from '@/features/auth/login-page';
import { clearToken } from '@/lib/auth-token';
import SideNav from './side-nav/side-nav';

/** 토큰에는 이름이 없어 로그인 사용자를 이 이름으로 표시한다 */
const ADMIN_DISPLAY_NAME = '관리자';

export function AppLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate(`/login?${LOGGED_OUT_QUERY}`, { replace: true });
  };

  return (
    <div>
      <SideNav user={ADMIN_DISPLAY_NAME} onLogout={handleLogout} />
    </div>
  );
}
