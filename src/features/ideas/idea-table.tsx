import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { POST_TYPE_LABELS } from '../posts/post-types'
import { IDEA_STATUS_LABELS, IDEA_STATUSES } from './idea-types'
import type { IdeaStatus } from './idea-types'
import type { SavedIdea } from './ideas-api'

interface IdeaRowStatus {
  isPending: (id: string) => boolean
  onChange: (idea: SavedIdea, status: IdeaStatus) => void
}

interface IdeaTableProps {
  ideas: SavedIdea[]
  onSelect: (idea: SavedIdea) => void
  /** 있으면 상태 칸이 대기·진행·완료 버튼이 되고, 없으면 상태 라벨만 보인다. */
  rowStatus?: IdeaRowStatus
}

export function IdeaTable({ ideas, onSelect, rowStatus }: IdeaTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>제목</TableHead>
          <TableHead>종류</TableHead>
          <TableHead>상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ideas.map(idea => (
          <TableRow
            key={idea.id}
            tabIndex={0}
            className="cursor-pointer"
            onClick={() => onSelect(idea)}
            onKeyDown={event => {
              // 상태 버튼에서 올라온 Enter는 버튼이 처리하므로 행 자체에 포커스가 있을 때만 선택한다
              if (event.key === 'Enter' && event.target === event.currentTarget) onSelect(idea)
            }}
          >
            <TableCell>{idea.title}</TableCell>
            <TableCell>{POST_TYPE_LABELS[idea.type]}</TableCell>
            <TableCell onClick={rowStatus ? event => event.stopPropagation() : undefined}>
              {rowStatus ? (
                <div className="flex gap-1">
                  {IDEA_STATUSES.map(status => (
                    <Button
                      key={status}
                      size="sm"
                      variant={status === idea.status ? 'default' : 'outline'}
                      aria-pressed={status === idea.status}
                      disabled={rowStatus.isPending(idea.id)}
                      onClick={() => rowStatus.onChange(idea, status)}
                    >
                      {IDEA_STATUS_LABELS[status]}
                    </Button>
                  ))}
                </div>
              ) : (
                IDEA_STATUS_LABELS[idea.status]
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
