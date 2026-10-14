import { useEffect, useState } from 'react'

/** 값이 바뀐 뒤 delayMs 동안 변화가 없을 때 반영되는 값을 반환한다. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timerId = setTimeout(() => setDebouncedValue(value), delayMs)

    return () => clearTimeout(timerId)
  }, [value, delayMs])

  return debouncedValue
}
