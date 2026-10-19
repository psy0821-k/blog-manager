import { useIdeas } from '../ideas/use-ideas';
import { IdeaProgressCard } from './idea-progress-card';

export function IdeaProgressSection() {
  const { state, reload } = useIdeas();

  return (
    <IdeaProgressCard
      ideas={state.status === 'success' ? state.data.data : []}
      status={state.status}
      onRetry={reload}
    />
  );
}
