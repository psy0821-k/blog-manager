import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPatch } from '../../../lib/api-client'
import type { PostType } from '../post-types'
import { updatePostPublished } from '../posts-api'

vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}))

const mockedApiPatch = vi.mocked(apiPatch)

beforeEach(() => {
  mockedApiPatch.mockReset()
  mockedApiPatch.mockResolvedValue(undefined)
})

describe('updatePostPublished', () => {
  describe('정상', () => {
    it.each<[PostType, string, boolean]>([
      ['PROJECT', '/api/projects/my-slug', true],
      ['PROJECT', '/api/projects/my-slug', false],
      ['LAB', '/api/lab/my-slug', true],
      ['LAB', '/api/lab/my-slug', false],
      ['DEV_LOG', '/api/devlog/my-slug', true],
      ['DEV_LOG', '/api/devlog/my-slug', false],
    ])('%s는 %s로 { published: %s } 본문과 함께 apiPatch를 호출해야 한다', async (type, path, published) => {
      await updatePostPublished(type, 'my-slug', published)

      expect(mockedApiPatch).toHaveBeenCalledTimes(1)
      expect(mockedApiPatch.mock.calls[0][0]).toBe(path)
      expect(mockedApiPatch.mock.calls[0][1]).toEqual({ published })
    })

    it('성공하면 undefined로 resolve해야 한다', async () => {
      await expect(updatePostPublished('PROJECT', 'my-slug', true)).resolves.toBeUndefined()
    })
  })

  describe('경계', () => {
    it('slug의 공백, /, ?, #, 한글은 encodeURIComponent 결과로 경로에 들어가야 한다', async () => {
      const slug = 'a b/c?d#e 한글'

      await updatePostPublished('PROJECT', slug, true)

      expect(mockedApiPatch.mock.calls[0][0]).toBe(`/api/projects/${encodeURIComponent(slug)}`)
    })
  })

  describe('예외', () => {
    it('apiPatch가 ApiError(404)로 reject하면 같은 오류를 그대로 전파해야 한다', async () => {
      const error = new ApiError(404, '요청에 실패했습니다. (404)')
      mockedApiPatch.mockRejectedValue(error)

      await expect(updatePostPublished('PROJECT', 'my-slug', true)).rejects.toBe(error)
    })
  })
})
