import { useCallback, useEffect, useState } from 'react'

export type FetchState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

type SettledState<T> = Exclude<FetchState<T>, { status: 'loading' }>

interface FetchResult<T> {
  fetcher: (signal: AbortSignal) => Promise<T>
  reloadCount: number
  state: SettledState<T>
}

/**
 * fetcher를 실행해 로딩/성공/에러 상태를 관리한다.
 * fetcher가 바뀌면 이전 요청을 취소하고 다시 요청하므로, 호출부에서 useCallback으로 감싸서 넘긴다.
 * 현재 fetcher/reloadCount에 대한 결과가 아직 없으면 로딩으로 간주한다.
 */
export function useFetch<T>(fetcher: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<FetchResult<T> | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    fetcher(controller.signal)
      .then((data) => setResult({ fetcher, reloadCount, state: { status: 'success', data } }))
      .catch((error: unknown) => {
        // 취소된 요청은 최신 요청의 상태를 덮어쓰지 않도록 무시한다
        if (controller.signal.aborted) {
          return
        }

        setResult({
          fetcher,
          reloadCount,
          state: {
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          },
        })
      })

    return () => controller.abort()
  }, [fetcher, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  const isCurrent = result?.fetcher === fetcher && result.reloadCount === reloadCount
  const state: FetchState<T> = isCurrent ? result.state : { status: 'loading' }

  return { state, reload }
}
