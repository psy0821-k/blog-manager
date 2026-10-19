import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../lib/api-client'
import { toSaveErrorMessage } from '../use-save-idea'

describe('toSaveErrorMessage', () => {
  it('ApiError(400)이면 입력 확인 안내를 돌려줘야 한다', () => {
    expect(toSaveErrorMessage(new ApiError(400, '실패'))).toBe('입력한 내용을 저장할 수 없어요. 제목과 메모를 확인해 주세요.')
  })

  it.each([401, 403])('ApiError(%i)이면 로그인 만료 안내를 돌려줘야 한다', (status) => {
    expect(toSaveErrorMessage(new ApiError(status, '실패'))).toBe('로그인이 만료됐거나 권한이 없어요. 다시 로그인해 주세요.')
  })

  it('그 밖의 ApiError(500)이면 상태 코드가 든 서버 오류 안내를 돌려줘야 한다', () => {
    expect(toSaveErrorMessage(new ApiError(500, '실패'))).toBe('서버 오류로 저장하지 못했어요. 잠시 후 다시 시도해 주세요. (500)')
  })

  it('ApiError가 아닌 오류이면 네트워크 안내를 돌려줘야 한다', () => {
    expect(toSaveErrorMessage(new TypeError('Failed to fetch'))).toBe(
      '서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.',
    )
  })
})
