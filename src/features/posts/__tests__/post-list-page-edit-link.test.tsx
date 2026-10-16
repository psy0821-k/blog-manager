import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCategories } from '../../categories/categories-api'
import { PostListPage } from '../post-list-page'
import type { PostListItem, PostListResponse } from '../post-types'
import { fetchPostList } from '../posts-api'

vi.mock('@/lib/env', () => ({ BLOG_API_URL: '', BLOG_LOGIN_URL: 'https://blog.example/admin-login' }))
vi.mock('../posts-api', () => ({ fetchPostList: vi.fn() }))
vi.mock('../../categories/categories-api', () => ({ fetchCategories: vi.fn() }))

const mockedFetchPostList = vi.mocked(fetchPostList)
const mockedFetchCategories = vi.mocked(fetchCategories)

const ORIGIN = 'https://blog.example'

function makeItem(slug: string, title: string): PostListItem {
  const date = '2026-10-08T12:00:00Z'
  return { id: slug, title, slug, viewCount: 0, createdAt: date, updatedAt: date }
}

function makeResponse(data: PostListItem[]): PostListResponse {
  return { data, meta: { page: 1, pageSize: 30, totalCount: data.length, totalPages: 1 } }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/manage']}>
      <PostListPage />
    </MemoryRouter>,
  )
}

describe('PostListPage 편집 링크 (오리진 있음)', () => {
  beforeEach(() => {
    mockedFetchPostList.mockReset()
    mockedFetchCategories.mockReset()
    mockedFetchCategories.mockResolvedValue([])
    mockedFetchPostList.mockImplementation(async ({ draft }) =>
      makeResponse([draft ? makeItem('draft-slug', '임시저장 글') : makeItem('pub-slug', '발행된 글')]),
    )
  })

  it('발행됨 보기의 글 행에 /projects/<slug>/edit 편집 링크가 보여야 한다', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: '편집' })

    expect(link).toHaveAttribute('href', `${ORIGIN}/projects/pub-slug/edit`)
  })

  it('임시저장 탭에서도 편집 링크가 그 글의 slug로 만들어지고 랩 탭에서는 /lab 경로여야 한다', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('발행된 글')

    await user.click(screen.getByRole('tab', { name: '임시저장' }))
    await screen.findByText('임시저장 글')

    expect(screen.getByRole('link', { name: '편집' })).toHaveAttribute('href', `${ORIGIN}/projects/draft-slug/edit`)

    await user.click(screen.getByRole('tab', { name: '랩' }))
    await screen.findByText('임시저장 글')

    expect(screen.getByRole('link', { name: '편집' })).toHaveAttribute('href', `${ORIGIN}/lab/draft-slug/edit`)
  })
})
