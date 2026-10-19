import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SERVER_DIR = import.meta.dirname
const REPO_ROOT = path.resolve(SERVER_DIR, '..')
const REQUIRED_KEYS = ['DATABASE_URL', 'DIRECT_URL', 'PORT', 'AUTH_SECRET']

/** KEY=값 형태의 줄만 { 키: 값 }으로 읽는다. 주석과 빈 줄은 건너뛴다. */
function parseEnvExample(): Record<string, string> {
  const text = readFileSync(path.join(SERVER_DIR, '.env.example'), 'utf-8')
  const entries: Record<string, string> = {}

  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) entries[match[1]] = match[2]
  }

  return entries
}

describe('server/.env.example', () => {
  it('DATABASE_URL, DIRECT_URL, PORT, AUTH_SECRET 키가 있어야 한다', () => {
    expect(Object.keys(parseEnvExample())).toEqual(expect.arrayContaining(REQUIRED_KEYS))
  })

  it('값은 비어 있고 postgres:// 같은 실제 연결 문자열이 없어야 한다', () => {
    const entries = parseEnvExample()

    for (const key of REQUIRED_KEYS) {
      expect(entries[key]).toBe('')
    }
    expect(readFileSync(path.join(SERVER_DIR, '.env.example'), 'utf-8')).not.toMatch(/postgres(ql)?:\/\//)
  })
})

describe('server/README.md', () => {
  it('AUTH_SECRET과 설명이 있어야 한다', () => {
    const readme = readFileSync(path.join(SERVER_DIR, 'README.md'), 'utf-8')

    expect(readme).toContain('AUTH_SECRET')
    expect(readme).toMatch(/AUTH_SECRET[^\n]*(블로그|서명|토큰)/)
  })
})

describe('server/.env.example ADMIN_APP_ORIGIN', () => {
  it('ADMIN_APP_ORIGIN 키가 있고 값이 비어 있어야 한다', () => {
    const entries = parseEnvExample()

    expect(Object.keys(entries)).toContain('ADMIN_APP_ORIGIN')
    expect(entries.ADMIN_APP_ORIGIN).toBe('')
  })
})

describe('server/README.md ADMIN_APP_ORIGIN', () => {
  it('ADMIN_APP_ORIGIN과 설명(개발 값은 Vite 오리진 5173)이 있어야 한다', () => {
    const readme = readFileSync(path.join(SERVER_DIR, 'README.md'), 'utf-8')

    expect(readme).toContain('ADMIN_APP_ORIGIN')
    expect(readme).toContain('5173')
    expect(readme).toMatch(/ADMIN_APP_ORIGIN[^\n]*(오리진|origin|Origin)/)
  })
})

describe('server/.env 커밋 제외', () => {
  it('server/.env는 git 추적 대상에서 제외돼야 한다', () => {
    const result = spawnSync('git', ['check-ignore', '-q', 'server/.env'], { cwd: REPO_ROOT })

    expect(result.status).toBe(0)
  })
})
