export interface PublicRoute {
  method: string
  path: string
}

// 인증 없이 열어 두는 경로
export const PUBLIC_ROUTES: readonly PublicRoute[] = [{ method: 'GET', path: '/health' }]

export function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some((route) => route.method === method && route.path === path)
}
