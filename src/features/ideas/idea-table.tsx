import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { POST_TYPE_LABELS } from '../posts/post-types'
import { IDEA_STATUS_LABELS } from './idea-types'
import type { SavedIdea } from './ideas-api'

interface IdeaTableProps {
  ideas: SavedIdea[]
  onSelect: (idea: SavedIdea) => void
}

export function IdeaTable({ ideas, onSelect }: IdeaTableProps) {
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
              if (event.key === 'Enter') onSelect(idea)
            }}
          >
            <TableCell>{idea.title}</TableCell>
            <TableCell>{POST_TYPE_LABELS[idea.type]}</TableCell>
            <TableCell>{IDEA_STATUS_LABELS[idea.status]}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
