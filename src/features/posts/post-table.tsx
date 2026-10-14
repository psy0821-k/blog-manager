import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { POST_STATUS_LABELS } from './post-types'
import type { PostListItem } from './post-types'

interface PostTableProps {
  posts: PostListItem[]
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('ko-KR')
}

/** 개발일지는 발행 번호를 제목 앞에 붙여 보여준다. */
function formatTitle({ title, devNumber }: PostListItem): string {
  return devNumber ? `#${devNumber} ${title}` : title
}

export function PostTable({ posts }: PostTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>제목</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="text-right">조회수</TableHead>
          <TableHead>작성일</TableHead>
          <TableHead>수정일</TableHead>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
