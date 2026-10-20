import { describe, expect, it } from 'vitest'
import { validateIdeaUpdate } from './validate-idea-update'

// 한도는 이슈 AC의 값을 그대로 쓴다(구현 상수와 독립적으로 검증)
const TITLE_LIMIT = 100
const MEMO_LIMIT = 2000

describe('validateIdeaUpdate', () => {
  describe('정상', () => {
    it('status만 있으면 { status }로 통과해야 한다', () => {
      expect(validateIdeaUpdate({ status: 'doing' })).toEqual({ ok: true, value: { status: 'doing' } })
    })

    it('title·memo·type·status를 모두 보내면 모두 통과해야 한다', () => {
      expect(validateIdeaUpdate({ title: '제목', memo: '메모', type: 'LAB', status: 'done' })).toEqual({
        ok: true,
        value: { title: '제목', memo: '메모', type: 'LAB', status: 'done' },
      })
    })

    it('title 앞뒤 공백은 제거한 값으로 통과해야 한다', () => {
      expect(validateIdeaUpdate({ title: '  제목  ' })).toEqual({ ok: true, value: { title: '제목' } })
    })
  })

  describe('경계', () => {
    it('memo가 빈 문자열이면 통과해야 한다(메모 지우기)', () => {
      expect(validateIdeaUpdate({ memo: '' })).toEqual({ ok: true, value: { memo: '' } })
    })

    it('title이 정확히 100자, memo가 정확히 2000자이면 통과해야 한다', () => {
      const title = 'a'.repeat(TITLE_LIMIT)
      const memo = 'b'.repeat(MEMO_LIMIT)

      expect(validateIdeaUpdate({ title, memo })).toEqual({ ok: true, value: { title, memo } })
    })

    it('알 수 없는 필드(id, createdAt)는 결과 값에 포함되지 않아야 한다', () => {
      expect(validateIdeaUpdate({ status: 'todo', id: 'other', createdAt: '2026-01-01' })).toEqual({
        ok: true,
        value: { status: 'todo' },
      })
    })

    it('여러 필드가 잘못되면 title → memo → type → status 순서로 첫 실패만 알려야 한다', () => {
      const bad = { title: '', memo: 1, type: 'OTHER', status: 'archived' }

      expect(validateIdeaUpdate(bad)).toEqual({ ok: false, reason: 'INVALID_TITLE' })
      expect(validateIdeaUpdate({ ...bad, title: '제목' })).toEqual({ ok: false, reason: 'INVALID_MEMO' })
      expect(validateIdeaUpdate({ ...bad, title: '제목', memo: '' })).toEqual({ ok: false, reason: 'INVALID_TYPE' })
      expect(validateIdeaUpdate({ ...bad, title: '제목', memo: '', type: 'LAB' })).toEqual({
        ok: false,
        reason: 'INVALID_STATUS',
      })
    })
  })

  describe('예외', () => {
    it.each([null, [], '문자열', undefined, 1])('본문이 %j이면 INVALID_BODY여야 한다', (body) => {
      expect(validateIdeaUpdate(body)).toEqual({ ok: false, reason: 'INVALID_BODY' })
    })

    it.each([{}, { id: 'x' }, { createdAt: '2026-01-01' }])('아는 필드가 하나도 없는 %j이면 INVALID_BODY여야 한다', (body) => {
      expect(validateIdeaUpdate(body)).toEqual({ ok: false, reason: 'INVALID_BODY' })
    })

    it.each([
      { label: '공백뿐', title: '   ' },
      { label: '101자', title: 'a'.repeat(TITLE_LIMIT + 1) },
      { label: '문자열이 아님', title: 1 },
      { label: 'null', title: null },
    ])('title이 $label이면 INVALID_TITLE여야 한다', ({ title }) => {
      expect(validateIdeaUpdate({ title })).toEqual({ ok: false, reason: 'INVALID_TITLE' })
    })

    it.each([
      { label: '2001자', memo: 'a'.repeat(MEMO_LIMIT + 1) },
      { label: 'null', memo: null },
      { label: '문자열이 아님', memo: 1 },
    ])('memo가 $label이면 INVALID_MEMO여야 한다', ({ memo }) => {
      expect(validateIdeaUpdate({ memo })).toEqual({ ok: false, reason: 'INVALID_MEMO' })
    })

    it('type이 허용되지 않은 값이면 INVALID_TYPE여야 한다', () => {
      expect(validateIdeaUpdate({ type: 'OTHER' })).toEqual({ ok: false, reason: 'INVALID_TYPE' })
    })

    it.each(['archived', 'TODO', 'Doing', ''])('status가 허용되지 않은 값 %j이면 INVALID_STATUS여야 한다', (status) => {
      expect(validateIdeaUpdate({ status })).toEqual({ ok: false, reason: 'INVALID_STATUS' })
    })

    it('status가 null이면 필드가 있는 것으로 보고 INVALID_STATUS여야 한다', () => {
      expect(validateIdeaUpdate({ status: null })).toEqual({ ok: false, reason: 'INVALID_STATUS' })
    })
  })
})
