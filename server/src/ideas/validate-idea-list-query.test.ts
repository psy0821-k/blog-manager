import { describe, expect, it } from 'vitest'
import { validateIdeaListQuery } from './validate-idea-list-query'

describe('validateIdeaListQuery', () => {
  it('status가 생략되면 필터 없이 통과해야 한다', () => {
    expect(validateIdeaListQuery({})).toEqual({ ok: true, value: {} })
  })

  it.each(['todo', 'doing', 'done'])('status가 %s이면 그 값으로 통과해야 한다', (status) => {
    expect(validateIdeaListQuery({ status })).toEqual({ ok: true, value: { status } })
  })

  it('다른 쿼리 키만 있고 status가 없으면 필터 없이 통과해야 한다', () => {
    expect(validateIdeaListQuery({ page: '2' })).toEqual({ ok: true, value: {} })
  })

  it.each([
    { label: '허용되지 않은 값', status: 'archived' },
    { label: '대소문자가 다른 값', status: 'TODO' },
    { label: '빈 문자열', status: '' },
    { label: '배열(?status=todo&status=done)', status: ['todo', 'done'] },
  ])('status가 $label이면 INVALID_STATUS여야 한다', ({ status }) => {
    expect(validateIdeaListQuery({ status })).toEqual({ ok: false, reason: 'INVALID_STATUS' })
  })
})
