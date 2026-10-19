import { Button } from '@/components/ui/button'
import { POST_TYPE_LABELS, POST_TYPES } from '../posts/post-types'
import type { PostType } from '../posts/post-types'

interface IdeaTypeButtonsProps {
  value: PostType
  onChange: (type: PostType) => void
}

/** 글감 종류(프로젝트·랩·개발일지)를 버튼 하나씩으로 고른다. 선택된 종류는 aria-pressed다. */
export function IdeaTypeButtons({ value, onChange }: IdeaTypeButtonsProps) {
  return (
    <>
      {POST_TYPES.map(postType => (
        <Button
          key={postType}
          type="button"
          size="sm"
          variant={value === postType ? 'default' : 'outline'}
          aria-pressed={value === postType}
          onClick={() => onChange(postType)}
        >
          {POST_TYPE_LABELS[postType]}
        </Button>
      ))}
    </>
  )
}
