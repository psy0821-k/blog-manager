export type EnvSource = Record<string, string | undefined>

const DEFAULT_PORT = 8787
const MIN_PORT = 1
const MAX_PORT = 65535

export class MissingEnvError extends Error {
  readonly key: string

  constructor(key: string) {
    // 값은 메시지에 넣지 않고 키 이름만 알린다
    super(`환경변수 ${key}가 설정되지 않았습니다.`)
    this.name = 'MissingEnvError'
    this.key = key
  }
}

export function readRequiredEnv(source: EnvSource, key: string): string {
  const value = source[key]?.trim()
  if (!value) throw new MissingEnvError(key)

  return value
}

export function readPort(source: EnvSource): number {
  const raw = source.PORT?.trim()
  if (!raw) return DEFAULT_PORT

  const port = Number(raw)
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`PORT는 ${MIN_PORT}~${MAX_PORT} 사이의 정수여야 합니다.`)
  }

  return port
}

export function readOptionalEnv(source: EnvSource, key: string): string | undefined {
  const value = source[key]?.trim()

  return value || undefined
}
