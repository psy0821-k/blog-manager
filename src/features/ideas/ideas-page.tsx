import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IdeaDetailDialog } from './idea-detail-dialog'
import { IdeaEditDialog } from './idea-edit-dialog'
import type { IdeaEditInput } from './idea-edit-dialog'
import { IdeaQuickAdd } from './idea-quick-add'
import { IdeaTable } from './idea-table'
import { IDEA_STATUS_LABELS, IDEA_STATUSES } from './idea-types'
import type { IdeaStatus } from './idea-types'
import type { NewIdeaInput, SavedIdea } from './ideas-api'
import { useIdeaActions } from './use-idea-actions'
import { useIdeas } from './use-ideas'
import { useSaveIdea } from './use-save-idea'
import { useUpdateIdea } from './use-update-idea'

const STATUS_PARAM = 'status'
const ALL_STATUSES = 'all'

function parseStatus(value: string | null): IdeaStatus | undefined {
  return IDEA_STATUSES.find(status => status === value)
}

export function IdeasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = parseStatus(searchParams.get(STATUS_PARAM))
  const { state, reload } = useIdeas(status)
  const { isPending, errorMessage, changeStatus } = useIdeaActions(reload)
  const { isSaving: isAdding, errorMessage: addErrorMessage, save } = useSaveIdea()
  const { isSaving: isUpdating, errorMessage: updateErrorMessage, update, resetError } = useUpdateIdea()
  const [selectedIdea, setSelectedIdea] = useState<SavedIdea | null>(null)
  const [editingIdea, setEditingIdea] = useState<SavedIdea | null>(null)

  async function addIdea(input: NewIdeaInput) {
    const saved = await save(input)

    if (saved) reload()

    return saved
  }

  function startEdit(idea: SavedIdea) {
    resetError()
    setSelectedIdea(null)
    setEditingIdea(idea)
  }

  // 수정을 접으면 상세 모달로 돌아간다
  function cancelEdit() {
    resetError()
    setSelectedIdea(editingIdea)
    setEditingIdea(null)
  }

  async function saveEdit(input: IdeaEditInput) {
    if (!editingIdea) return

    const updated = await update(editingIdea.id, input)

    if (updated) {
      reload()
      setEditingIdea(null)
      setSelectedIdea(updated)
    }
  }

  function changeStatusFilter(value: string) {
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

      <IdeaQuickAdd isSaving={isAdding} errorMessage={addErrorMessage} onAdd={addIdea} />

      <Tabs value={status ?? ALL_STATUSES} onValueChange={changeStatusFilter}>
        <TabsList>
          <TabsTrigger value={ALL_STATUSES}>전체</TabsTrigger>
          {IDEA_STATUSES.map(ideaStatus => (
            <TabsTrigger key={ideaStatus} value={ideaStatus}>
              {IDEA_STATUS_LABELS[ideaStatus]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}

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
          <IdeaTable
            ideas={state.data.data}
            onSelect={setSelectedIdea}
            rowStatus={{ isPending, onChange: (idea, nextStatus) => void changeStatus(idea.id, nextStatus) }}
          />
        ))}

      <IdeaDetailDialog idea={selectedIdea} onClose={() => setSelectedIdea(null)} onEdit={startEdit} />

      <IdeaEditDialog
        idea={editingIdea}
        isSaving={isUpdating}
        errorMessage={updateErrorMessage}
        onClose={cancelEdit}
        onSave={input => void saveEdit(input)}
      />
    </section>
  )
}
