import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiDelete, apiPatch } from '../../../lib/api-client'
import type { PostType } from '../post-types'
import { deletePost, updatePostPublished } from '../posts-api'

vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}))

const mockedApiPatch = vi.mocked(apiPatch)
const mockedApiDelete = vi.mocked(apiDelete)

beforeEach(() => {
  mockedApiPatch.mockReset()
  mockedApiPatch.mockResolvedValue(undefined)
  mockedApiDelete.mockReset()
  mockedApiDelete.mockResolvedValue(undefined)
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

describe('deletePost', () => {
  describe('정상', () => {
    it.each<[PostType, string]>([
      ['PROJECT', '/api/projects/my-slug'],
      ['LAB', '/api/lab/my-slug'],
      ['DEV_LOG', '/api/devlog/my-slug'],
    ])('%s는 %s로 apiDelete를 호출해야 한다', async (type, path) => {
      await deletePost(type, 'my-slug')

      expect(mockedApiDelete).toHaveBeenCalledTimes(1)
      expect(mockedApiDelete.mock.calls[0][0]).toBe(path)
    })

    it('성공하면 undefined로 resolve해야 한다', async () => {
      await expect(deletePost('PROJECT', 'my-slug')).resolves.toBeUndefined()
    })
  })

  describe('경계', () => {
    it('slug의 공백, /, ?, #, 한글은 encodeURIComponent 결과로 경로에 들어가야 한다', async () => {
      const slug = 'a b/c?d#e 한글'

      await deletePost('PROJECT', slug)

      expect(mockedApiDelete.mock.calls[0][0]).toBe(`/api/projects/${encodeURIComponent(slug)}`)
    })

    it.each(['a/b', '../x', 'a?x=1', 'a#frag', '%2e%2e', '%2e%2e/admin', 'a b', '한글 슬러그', 'a%2Fb'])(
      '경로 주입 시도 slug %j는 경로 세그먼트 하나로만 인코딩돼 들어가야 한다',
      async (slug) => {
        await deletePost('PROJECT', slug)

        const path = mockedApiDelete.mock.calls[0][0]
        const segment = path.slice('/api/projects/'.length)

        expect(path).toBe(`/api/projects/${encodeURIComponent(slug)}`)
        expect(segment).not.toMatch(/[/?#\s]/)
        expect(decodeURIComponent(segment)).toBe(slug)
      },
    )
  })

  describe('예외', () => {
    it('apiDelete가 ApiError(404)로 reject하면 같은 오류를 그대로 전파해야 한다', async () => {
      const error = new ApiError(404, '요청에 실패했습니다. (404)')
      mockedApiDelete.mockRejectedValue(error)

      await expect(deletePost('PROJECT', 'my-slug')).rejects.toBe(error)
    })
  })
})
