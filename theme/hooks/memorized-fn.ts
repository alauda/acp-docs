import { useCallback, useRef } from 'react'

export const useMemorizedFn = <T extends (...args: any[]) => any>(fn: T): T => {
  const fnRef = useRef(fn)
  fnRef.current = fn
  return useCallback(
    (...args: Parameters<T>): ReturnType<T> => fnRef.current(...args),
    [],
  ) as T
}
