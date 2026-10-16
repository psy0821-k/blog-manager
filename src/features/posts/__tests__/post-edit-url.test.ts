import { describe, expect, it } from 'vitest'
import { buildPostEditUrl, getBlogOrigin } from '../post-edit-url'
import type { PostType } from '../post-types'

const ORIGIN = 'https://blog.example'

describe('buildPostEditUrl', () => {
  describe('정상', () => {
    it('PROJECT는 /projects/<slug>/edit 주소를 돌려줘야 한다', () => {
      expect(buildPostEditUrl('PROJECT', 'my-post', ORIGIN)).toBe('https://blog.example/projects/my-post/edit')
    })

    it.each<[PostType, string]>([
      ['PROJECT', 'projects'],
      ['LAB', 'lab'],
      ['DEV_LOG', 'devlog'],
    ])('%s는 /%s/<slug>/edit 경로를 돌려줘야 한다', (type, segment) => {
      expect(buildPostEditUrl(type, 'my-post', ORIGIN)).toBe(`${ORIGIN}/${segment}/my-post/edit`)
    })
  })

  describe('경계', () => {
    it('slug에 공백이 있으면 %20으로 인코딩해야 한다', () => {
      expect(buildPostEditUrl('PROJECT', 'hello world', ORIGIN)).toBe(`${ORIGIN}/projects/hello%20world/edit`)
    })

    it('slug의 / ? # %를 각각 %2F %3F %23 %25로 인코딩해야 한다', () => {
      expect(buildPostEditUrl('PROJECT', 'a/b?c#d%e', ORIGIN)).toBe(`${ORIGIN}/projects/a%2Fb%3Fc%23d%25e/edit`)
    })

    it('경로 탐색 문자열 ../x는 ..%2Fx가 되어야 한다', () => {
      expect(buildPostEditUrl('PROJECT', '../x', ORIGIN)).toBe(`${ORIGIN}/projects/..%2Fx/edit`)
    })

    it('한글 slug는 encodeURIComponent 결과와 같아야 한다', () => {
      expect(buildPostEditUrl('LAB', '안녕 글', ORIGIN)).toBe(`${ORIGIN}/lab/${encodeURIComponent('안녕 글')}/edit`)
    })
  })
})

describe('getBlogOrigin', () => {
  describe('정상', () => {
    it('경로가 있는 로그인 주소에서 경로를 뺀 오리진을 돌려줘야 한다', () => {
      expect(getBlogOrigin('http://localhost:3999/admin-login')).toBe('http://localhost:3999')
    })
  })

  describe('경계', () => {
    it.each([
      ['https://blog.example/', 'https://blog.example'],
      ['https://blog.example/login?next=1#a', 'https://blog.example'],
      ['http://localhost:3999', 'http://localhost:3999'],
    ])('%s는 %s여야 한다', (input, expected) => {
      expect(getBlogOrigin(input)).toBe(expected)
    })
  })

  describe('예외', () => {
    it('빈 문자열이면 null이어야 한다', () => {
      expect(getBlogOrigin('')).toBeNull()
    })

    it.each(['not a url', '/admin-login', '   '])('올바른 URL이 아닌 "%s"는 예외 없이 null이어야 한다', (input) => {
      expect(getBlogOrigin(input)).toBeNull()
    })

    it.each(['javascript:alert(1)', 'data:text/html,x', 'ftp://x.example'])(
      'http(s)가 아닌 "%s"는 null이어야 한다',
      (input) => {
        expect(getBlogOrigin(input)).toBeNull()
      },
    )
  })
})
