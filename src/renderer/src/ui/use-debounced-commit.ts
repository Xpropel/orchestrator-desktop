import { useEffect, useRef, useState } from 'react'

export function useDebouncedCommit(
  value: string,
  onCommit: (value: string) => void,
  delay: number,
  exists?: () => boolean
): {
  local: string
  setLocal: (next: string) => void
} {
  const [local, setLocal] = useState(value)
  const committedRef = useRef(value)
  const localRef = useRef(local)
  const onCommitRef = useRef(onCommit)
  const existsRef = useRef(exists)
  onCommitRef.current = onCommit
  existsRef.current = exists
  localRef.current = local

  useEffect(() => {
    setLocal(value)
    committedRef.current = value
  }, [value])

  const flush = (next: string): void => {
    if (existsRef.current && !existsRef.current()) {
      return
    }
    committedRef.current = next
    onCommitRef.current(next)
  }

  useEffect(() => {
    if (local === committedRef.current) {
      return
    }
    const timer = window.setTimeout(() => {
      flush(local)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [local, delay])

  useEffect(() => {
    return () => {
      if (localRef.current !== committedRef.current) {
        flush(localRef.current)
      }
    }
  }, [])

  return { local, setLocal }
}
