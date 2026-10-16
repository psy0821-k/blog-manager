import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PostTable } from '../post-table'
import type { PostListItem, PostType } from '../post-types'

const ORIGIN = 'https://blog.example'
const DATE = '2026-10-08T12:00:00Z'

function makeItem(slug: string, title = `${slug} 제목`, devNumber?: number): PostListItem {
  return { id: slug, title, slug, viewCount: 0, createdAt: DATE, updatedAt: DATE, devNumber }
}

function renderTable(posts: PostListItem[], type: PostType = 'PROJECT', blogOrigin: string | null = ORIGIN) {
  return render(<PostTable posts={posts} type={type} blogOrigin={blogOrigin} />)
}

function editLinkOfRow(title: string): HTMLElement {
  const row = screen.getByText(title).closest('tr')
  if (!row) throw new Error('행을 찾을 수 없다')
  return within(row).getByRole('link', { name: '편집' })
}

describe('PostTable 편집 링크', () => {
  describe('정상', () => {
    it('각 행의 편집 링크 href가 해당 행 slug로 만든 주소여야 한다', () => {
      renderTable([makeItem('first'), makeItem('second')])

      expect(editLinkOfRow('first 제목')).toHaveAttribute('href', `${ORIGIN}/projects/first/edit`)
      expect(editLinkOfRow('second 제목')).toHaveAttribute('href', `${ORIGIN}/projects/second/edit`)
    })

    it('편집 링크는 새 탭으로 열리고 rel에 noopener와 noreferrer를 포함해야 한다', () => {
      renderTable([makeItem('first')])

      const link = editLinkOfRow('first 제목')

      expect(link).toHaveAttribute('target', '_blank')
      const rel = (link.getAttribute('rel') ?? '').split(/\s+/)
      expect(rel).toContain('noopener')
      expect(rel).toContain('noreferrer')
    })

    it.each<[PostType, string]>([
      ['LAB', 'lab'],
      ['DEV_LOG', 'devlog'],
    ])('%s는 /%s/<slug>/edit 링크여야 한다', (type, segment) => {
      renderTable([makeItem('first')], type)

      expect(editLinkOfRow('first 제목')).toHaveAttribute('href', `${ORIGIN}/${segment}/first/edit`)
    })

    it('blogOrigin이 있으면 헤더에 편집 열이 있어야 한다', () => {
      renderTable([makeItem('first')])

      expect(screen.getByRole('columnheader', { name: '편집' })).toBeInTheDocument()
    })
  })

  describe('경계', () => {
    it('slug의 공백과 특수문자는 인코딩된 href여야 한다', () => {
      renderTable([makeItem('hello world', '공백 글'), makeItem('a/b?c#d', '특수 글')])

      expect(editLinkOfRow('공백 글').getAttribute('href')).toBe(`${ORIGIN}/projects/hello%20world/edit`)
      expect(editLinkOfRow('특수 글').getAttribute('href')).toBe(`${ORIGIN}/projects/a%2Fb%3Fc%23d/edit`)
    })

    it('글이 0건이어도 오류 없이 렌더되고 편집 링크는 없어야 한다', () => {
      renderTable([])

      expect(screen.queryByRole('link', { name: '편집' })).not.toBeInTheDocument()
    })

    it('개발일지 행의 링크는 제목이 아니라 slug로 만들어져야 한다', () => {
      renderTable([makeItem('devlog-slug', '개발 제목', 7)], 'DEV_LOG')

      expect(screen.getByText('#7 개발 제목')).toBeInTheDocument()
      expect(editLinkOfRow('#7 개발 제목')).toHaveAttribute('href', `${ORIGIN}/devlog/devlog-slug/edit`)
    })
  })

  describe('예외', () => {
    it('blogOrigin이 null이면 편집 링크와 편집 헤더가 없고 나머지 열은 그대로여야 한다', () => {
      renderTable([makeItem('first')], 'PROJECT', null)

      expect(screen.queryByRole('link', { name: '편집' })).not.toBeInTheDocument()
      expect(screen.queryByRole('columnheader', { name: '편집' })).not.toBeInTheDocument()
      for (const name of ['제목', '상태', '조회수', '작성일', '수정일']) {
        expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
      }
      expect(screen.getByText('first 제목')).toBeInTheDocument()
    })
  })
})
