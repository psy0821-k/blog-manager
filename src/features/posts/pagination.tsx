import { Button } from '@/components/ui/button'
import type { PaginationMeta } from './post-types'

interface PaginationProps {
  meta: PaginationMeta
  onPageChange: (page: number) => void
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  const { page, totalPages, totalCount } = meta

  return (
    <nav className="flex items-center justify-center gap-4" aria-label="페이지 이동">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        이전
      </Button>
      <span className="text-sm">
        {page} / {Math.max(totalPages, 1)} (총 {totalCount}개)
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        다음
      </Button>
    </nav>
  )
}
