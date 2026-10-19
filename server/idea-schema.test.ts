import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const PRISMA_DIR = path.join(import.meta.dirname, 'prisma')

function readSchema(): string {
  return readFileSync(path.join(PRISMA_DIR, 'schema.prisma'), 'utf-8')
}

/** `enum 이름 { ... }` 블록의 값 이름만 순서대로 돌려준다. */
function readEnumValues(schema: string, name: string): string[] {
  const block = new RegExp(`enum ${name}\\s*\\{([^}]*)\\}`).exec(schema)?.[1] ?? ''

  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('//'))
}

/** `model 이름 { ... }` 블록 전체 */
function readModelBlock(schema: string, name: string): string {
  return new RegExp(`model ${name}\\s*\\{([^}]*)\\}`).exec(schema)?.[1] ?? ''
}

describe('schema.prisma 글감 모델', () => {
  it('IdeaType, IdeaStatus enum과 Idea 모델의 필드(status 기본값 todo, memo 기본값 빈 문자열)가 있어야 한다', () => {
    const schema = readSchema()
    const model = readModelBlock(schema, 'Idea')

    expect(readEnumValues(schema, 'IdeaType')).toEqual(['PROJECT', 'LAB', 'DEV_LOG'])
    expect(readEnumValues(schema, 'IdeaStatus')).toEqual(['todo', 'doing', 'done'])
    expect(model).toMatch(/id\s+String\s+@id\s+@default\(uuid\(\)\)/)
    expect(model).toMatch(/title\s+String/)
    expect(model).toMatch(/memo\s+String\s+@default\(""\)/)
    expect(model).toMatch(/type\s+IdeaType/)
    expect(model).toMatch(/status\s+IdeaStatus\s+@default\(todo\)/)
    expect(model).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/)
    expect(model).toMatch(/updatedAt\s+DateTime\s+@updatedAt/)
    expect(model).toMatch(/@@map\("ideas"\)/)
  })
})

describe('글감 마이그레이션 SQL', () => {
  it('ideas 테이블과 IdeaType, IdeaStatus enum 타입을 만들어야 한다', () => {
    const migrationsDir = path.join(PRISMA_DIR, 'migrations')
    const folder = readdirSync(migrationsDir).find((entry) => entry.endsWith('_create_ideas'))

    expect(folder).toBeDefined()

    const sql = readFileSync(path.join(migrationsDir, folder ?? '', 'migration.sql'), 'utf-8')

    expect(sql).toMatch(/CREATE TYPE "IdeaType" AS ENUM \('PROJECT', 'LAB', 'DEV_LOG'\)/)
    expect(sql).toMatch(/CREATE TYPE "IdeaStatus" AS ENUM \('todo', 'doing', 'done'\)/)
    expect(sql).toMatch(/CREATE TABLE "ideas"/)
  })
})
