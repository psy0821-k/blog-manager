import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { buildPostEditUrl } from './post-edit-url'
import { POST_STATUS_LABELS } from './post-types'
import type { PostListItem, PostType } from './post-types'

const PENDING_LABEL = '처리 중…'

interface PostRowToggle {
  /** 버튼 문구. 보기마다 다르다(발행됨 보기: '임시저장으로 전환', 임시저장 보기: '발행'). */
  label: string
  isPending: (id: string) => boolean
  onToggle: (post: PostListItem) => void
}

interface PostRowDelete {
  isPending: (id: string) => boolean
  onDelete: (post: PostListItem) => void
}

interface PostTableProps {
  posts: PostListItem[]
  /** 글 종류. 편집 링크의 경로를 정한다. */
  type: PostType
  /** 블로그 오리진. null이면 편집 링크 열을 그리지 않는다. */
  blogOrigin: string | null
  /** 없으면 상태 변경 열을 그리지 않는다. */
  rowToggle?: PostRowToggle
  /** 없으면 삭제 열을 그리지 않는다. */
  rowDelete?: PostRowDelete
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('ko-KR')
}

/** 개발일지는 발행 번호를 제목 앞에 붙여 보여준다. */
function formatTitle({ title, devNumber }: PostListItem): string {
  return devNumber ? `#${devNumber} ${title}` : title
}

export function PostTable({ posts, type, blogOrigin, rowToggle, rowDelete }: PostTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>제목</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="text-right">조회수</TableHead>
          <TableHead>작성일</TableHead>
          <TableHead>수정일</TableHead>
          {blogOrigin !== null && <TableHead>편집</TableHead>}
          {rowToggle && <TableHead>상태 변경</TableHead>}
          {rowDelete && <TableHead>삭제</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => (
          <TableRow key={post.id}>
            <TableCell className="font-medium">{formatTitle(post)}</TableCell>
            <TableCell>
              {post.status ? <Badge variant="secondary">{POST_STATUS_LABELS[post.status]}</Badge> : '-'}
            </TableCell>
            <TableCell className="text-right">{post.viewCount}</TableCell>
            <TableCell>{formatDate(post.createdAt)}</TableCell>
            <TableCell>{formatDate(post.updatedAt)}</TableCell>
            {blogOrigin !== null && (
              <TableCell>
                <Button asChild variant="link" size="sm">
                  <a href={buildPostEditUrl(type, post.slug, blogOrigin)} target="_blank" rel="noopener noreferrer">
                    편집
                  </a>
                </Button>
              </TableCell>
            )}
            {rowToggle && (
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rowToggle.isPending(post.id)}
                  onClick={() => rowToggle.onToggle(post)}
                >
                  {rowToggle.isPending(post.id) ? PENDING_LABEL : rowToggle.label}
                </Button>
              </TableCell>
            )}
            {rowDelete && (
              <TableCell>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={rowDelete.isPending(post.id)}
                  onClick={() => rowDelete.onDelete(post)}
                >
                  삭제
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
