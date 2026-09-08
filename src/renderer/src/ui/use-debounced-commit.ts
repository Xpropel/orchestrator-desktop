import { useEffect, useRef, useState } from 'react'

/** Incoming store value is our own commit echo — keep in-progress keystrokes. */
export function nextDebouncedFromIncoming(
  local: string,
  committed: string,
  incoming: string
): { local: string; committed: string } | null {
  if (local !== committed && incoming === committed) {
    return null
  }
  if (incoming === local && incoming === committed) {
    return null
  }
  if (incoming === local) {
    return { local, committed: incoming }
  }
  return { local: incoming, committed: incoming }
}

export function useDebouncedCommit(
  value: string,
  onCommit: (value: string) => void,
  delay: number,
  exists?: () => boolean
): {
  local: string
  setLocal: (next: string) => void
  commitNow: () => void
  revert: () => void
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
    const next = nextDebouncedFromIncoming(localRef.current, committedRef.current, value)
    if (!next) return
    committedRef.current = next.committed
    if (next.local !== localRef.current) {
      setLocal(next.local)
    }
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

  const commitNow = (): void => {
    if (localRef.current !== committedRef.current) {
      flush(localRef.current)
    }
  }

  const revert = (): void => {
    setLocal(committedRef.current)
  }

  return { local, setLocal, commitNow, revert }
}
