import { describe, expect, it } from 'vitest'
import { validateNewIdea } from './validate-new-idea'

// 한도는 이슈 AC의 값을 그대로 쓴다(구현 상수와 독립적으로 검증)
const TITLE_LIMIT = 100
const MEMO_LIMIT = 2000

const validBody = { title: '제목', memo: '메모', type: 'PROJECT' }

describe('validateNewIdea', () => {
  it('유효한 title·memo·type이면 ok: true와 그 값을 돌려줘야 한다', () => {
    expect(validateNewIdea(validBody)).toEqual({
      ok: true,
      value: { title: '제목', memo: '메모', type: 'PROJECT' },
    })
  })

  it.each(['PROJECT', 'LAB', 'DEV_LOG'])('type이 %s이면 ok: true여야 한다', (type) => {
    expect(validateNewIdea({ ...validBody, type })).toEqual({
      ok: true,
      value: { title: '제목', memo: '메모', type },
    })
  })

  it('title 앞뒤에 공백이 있으면 공백을 제거한 값을 돌려줘야 한다', () => {
    expect(validateNewIdea({ ...validBody, title: '  제목  ' })).toEqual({
      ok: true,
      value: { title: '제목', memo: '메모', type: 'PROJECT' },
    })
  })

  it('memo를 생략하면 빈 문자열로 돌려줘야 한다', () => {
    expect(validateNewIdea({ title: '제목', type: 'LAB' })).toEqual({
      ok: true,
      value: { title: '제목', memo: '', type: 'LAB' },
    })
  })

  it('memo가 빈 문자열이면 ok: true와 빈 문자열을 돌려줘야 한다', () => {
    expect(validateNewIdea({ ...validBody, memo: '' })).toEqual({
      ok: true,
      value: { title: '제목', memo: '', type: 'PROJECT' },
    })
  })

  it('본문에 status가 있어도 결과 값에 포함하지 않아야 한다', () => {
    expect(validateNewIdea({ ...validBody, status: 'done' })).toEqual({
      ok: true,
      value: { title: '제목', memo: '메모', type: 'PROJECT' },
    })
  })

  it('title이 공백 제외 정확히 100자이면 ok: true여야 한다', () => {
    const title = 'a'.repeat(TITLE_LIMIT)

    expect(validateNewIdea({ ...validBody, title })).toEqual({
      ok: true,
      value: { title, memo: '메모', type: 'PROJECT' },
    })
  })

  it('title이 공백 제외 101자이면 INVALID_TITLE이어야 한다', () => {
    expect(validateNewIdea({ ...validBody, title: 'a'.repeat(TITLE_LIMIT + 1) })).toEqual({
      ok: false,
      reason: 'INVALID_TITLE',
    })
  })

  it('title이 앞뒤 공백 포함 100자를 넘어도 공백 제외 100자 이하이면 ok: true여야 한다', () => {
    const trimmed = 'a'.repeat(TITLE_LIMIT)

    expect(validateNewIdea({ ...validBody, title: `  ${trimmed}  ` })).toEqual({
      ok: true,
      value: { title: trimmed, memo: '메모', type: 'PROJECT' },
    })
  })

  it('memo가 정확히 2000자이면 ok: true여야 한다', () => {
    const memo = 'a'.repeat(MEMO_LIMIT)

    expect(validateNewIdea({ ...validBody, memo })).toEqual({
      ok: true,
      value: { title: '제목', memo, type: 'PROJECT' },
    })
  })

  it('memo가 2001자이면 INVALID_MEMO여야 한다', () => {
    expect(validateNewIdea({ ...validBody, memo: 'a'.repeat(MEMO_LIMIT + 1) })).toEqual({
      ok: false,
      reason: 'INVALID_MEMO',
    })
  })

  it('여러 필드가 잘못되면 본문 → title → memo → type 순서로 첫 실패 reason만 돌려줘야 한다', () => {
    expect(validateNewIdea(null)).toEqual({ ok: false, reason: 'INVALID_BODY' })
    expect(validateNewIdea({ title: '', memo: 123, type: 'x' })).toEqual({ ok: false, reason: 'INVALID_TITLE' })
    expect(validateNewIdea({ title: '제목', memo: 123, type: 'x' })).toEqual({ ok: false, reason: 'INVALID_MEMO' })
    expect(validateNewIdea({ title: '제목', type: 'x' })).toEqual({ ok: false, reason: 'INVALID_TYPE' })
  })

  it('title이 없으면 INVALID_TITLE이어야 한다', () => {
    expect(validateNewIdea({ memo: '메모', type: 'PROJECT' })).toEqual({ ok: false, reason: 'INVALID_TITLE' })
  })

  it('title이 공백뿐이면 INVALID_TITLE이어야 한다', () => {
    expect(validateNewIdea({ ...validBody, title: '   ' })).toEqual({ ok: false, reason: 'INVALID_TITLE' })
  })

  it('title이 문자열이 아니면(숫자 등) INVALID_TITLE이어야 한다', () => {
    expect(validateNewIdea({ ...validBody, title: 123 })).toEqual({ ok: false, reason: 'INVALID_TITLE' })
  })

  it.each([123, null])('memo가 문자열이 아니면(%s) INVALID_MEMO여야 한다', (memo) => {
    expect(validateNewIdea({ ...validBody, memo })).toEqual({ ok: false, reason: 'INVALID_MEMO' })
  })

  it.each([undefined, 'OTHER', 'project'])('type이 없거나 허용 목록 밖이면(%s) INVALID_TYPE이어야 한다', (type) => {
    expect(validateNewIdea({ ...validBody, type })).toEqual({ ok: false, reason: 'INVALID_TYPE' })
  })

  it('type이 문자열이 아니면 INVALID_TYPE이어야 한다', () => {
    expect(validateNewIdea({ ...validBody, type: 1 })).toEqual({ ok: false, reason: 'INVALID_TYPE' })
  })

  it.each([undefined, null, [], '문자열'])('본문이 객체가 아니면(%j) INVALID_BODY여야 한다', (body) => {
    expect(validateNewIdea(body)).toEqual({ ok: false, reason: 'INVALID_BODY' })
  })
})
