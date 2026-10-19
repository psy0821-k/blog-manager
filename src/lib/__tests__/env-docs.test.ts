/// <reference types="node" />
// 프론트 tsconfig에는 node 타입이 없고 Vite가 .env* 파일의 ?raw import를 막으므로, 이 파일에서만 node:fs로 읽는다
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const SERVER_KEYS = ['SERVER_API_PROXY_TARGET', 'VITE_SERVER_API_URL']

const envExample = readFileSync(path.join(REPO_ROOT, '.env.example'), 'utf-8')
const claudeMd = readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf-8')

/** KEY=값 형태의 줄만 { 키: 값 }으로 읽는다. 주석과 빈 줄은 건너뛴다. */
function parseEnvExample(): Record<string, string> {
  const entries: Record<string, string> = {}

  for (const line of envExample.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) entries[match[1]] = match[2]
  }

  return entries
}

/** 키 줄 바로 위에 이어진 주석 줄들을 하나의 문자열로 돌려준다. */
function readCommentAbove(key: string): string {
  const lines = envExample.split(/\r?\n/)
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`))
  const comments: string[] = []

  for (let i = index - 1; i >= 0 && lines[i].trim().startsWith('#'); i -= 1) {
    comments.unshift(lines[i])
  }

  return comments.join('\n')
}

describe('루트 .env.example 자체 서버 설정', () => {
  it('SERVER_API_PROXY_TARGET, VITE_SERVER_API_URL 키가 있고 값은 비어 있어야 한다', () => {
    const entries = parseEnvExample()

    for (const key of SERVER_KEYS) {
      expect(Object.keys(entries)).toContain(key)
      expect(entries[key]).toBe('')
    }
  })

  it('개발 중에는 VITE_SERVER_API_URL을 비운다는 설명이 있어야 한다', () => {
    expect(readCommentAbove('VITE_SERVER_API_URL')).toMatch(/개발[\s\S]*(비워|비운|비우)/)
  })
})

describe('CLAUDE.md 자체 서버 설정', () => {
  it('두 키와 개발 중에는 VITE_SERVER_API_URL을 비운다는 설명이 있어야 한다', () => {
    for (const key of SERVER_KEYS) {
      expect(claudeMd).toContain(key)
    }
    expect(claudeMd).toMatch(/VITE_SERVER_API_URL[\s\S]{0,200}(비워|비운|비우)/)
  })
})
