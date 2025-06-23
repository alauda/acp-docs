import { useCallback, useRef } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useMemoizedFn = <T extends (...args: any[]) => any>(fn: T): T => {
  const fnRef = useRef(fn)
  fnRef.current = fn
  return useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    (...args: Parameters<T>): ReturnType<T> => fnRef.current(...args),
    [],
  ) as T
}
