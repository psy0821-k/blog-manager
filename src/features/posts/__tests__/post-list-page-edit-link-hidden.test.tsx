import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCategories } from '../../categories/categories-api'
import { PostListPage } from '../post-list-page'
import { fetchPostList } from '../posts-api'

vi.mock('@/lib/env', () => ({ BLOG_API_URL: '', BLOG_LOGIN_URL: '' }))
vi.mock('../posts-api', () => ({ fetchPostList: vi.fn() }))
vi.mock('../../categories/categories-api', () => ({ fetchCategories: vi.fn() }))

const mockedFetchPostList = vi.mocked(fetchPostList)
const mockedFetchCategories = vi.mocked(fetchCategories)

describe('PostListPage 편집 링크 (오리진 없음)', () => {
  beforeEach(() => {
    mockedFetchPostList.mockReset()
    mockedFetchCategories.mockReset()
    mockedFetchCategories.mockResolvedValue([])
  })

  it('블로그 주소가 비어 있으면 글 제목은 보이지만 편집 링크는 없어야 한다', async () => {
    const date = '2026-10-08T12:00:00Z'
    mockedFetchPostList.mockResolvedValue({
      data: [{ id: 'p1', title: '발행된 글', slug: 'p1', viewCount: 0, createdAt: date, updatedAt: date }],
      meta: { page: 1, pageSize: 30, totalCount: 1, totalPages: 1 },
    })

    render(
      <MemoryRouter initialEntries={['/manage']}>
        <PostListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('발행된 글')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '편집' })).not.toBeInTheDocument()
  })
})
