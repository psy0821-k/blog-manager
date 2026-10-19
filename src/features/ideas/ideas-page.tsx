import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IdeaDetailDialog } from './idea-detail-dialog'
import { IdeaTable } from './idea-table'
import { IDEA_STATUS_LABELS, IDEA_STATUSES } from './idea-types'
import type { IdeaStatus } from './idea-types'
import type { SavedIdea } from './ideas-api'
import { useIdeas } from './use-ideas'

const STATUS_PARAM = 'status'
const ALL_STATUSES = 'all'

function parseStatus(value: string | null): IdeaStatus | undefined {
  return IDEA_STATUSES.find(status => status === value)
}

export function IdeasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = parseStatus(searchParams.get(STATUS_PARAM))
  const { state, reload } = useIdeas(status)
  const [selectedIdea, setSelectedIdea] = useState<SavedIdea | null>(null)

  function changeStatus(value: string) {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)

        if (value === ALL_STATUSES) {
          next.delete(STATUS_PARAM)
        } else {
          next.set(STATUS_PARAM, value)
        }

        return next
      },
      { replace: true }
    )
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">글감 아이디어</h1>

      <Tabs value={status ?? ALL_STATUSES} onValueChange={changeStatus}>
        <TabsList>
          <TabsTrigger value={ALL_STATUSES}>전체</TabsTrigger>
          {IDEA_STATUSES.map(ideaStatus => (
            <TabsTrigger key={ideaStatus} value={ideaStatus}>
              {IDEA_STATUS_LABELS[ideaStatus]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {state.status === 'loading' && <p className="text-sm">불러오는 중...</p>}

      {state.status === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{state.error.message}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            다시 시도
          </Button>
        </div>
      )}

      {state.status === 'success' &&
        (state.data.data.length === 0 ? (
          <p className="text-sm">글감이 없습니다.</p>
        ) : (
          <IdeaTable ideas={state.data.data} onSelect={setSelectedIdea} />
        ))}

      <IdeaDetailDialog idea={selectedIdea} onClose={() => setSelectedIdea(null)} />
    </section>
  )
}
