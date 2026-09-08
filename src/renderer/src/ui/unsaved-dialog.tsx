import { useEffect, useState, type JSX } from 'react'
import { ACTION_LABEL } from '@shared/action-labels'
import type { UnsavedChoice } from '../../../preload/index.d'
import { Button } from './button'

type DialogState = {
  message: string
  resolve: (choice: UnsavedChoice) => void
} | null

let current: DialogState = null
const listeners = new Set<(state: DialogState) => void>()

function emit(state: DialogState): void {
  current = state
  for (const listener of listeners) {
    listener(state)
  }
}

export function cancelOpenUnsavedDialog(): void {
  if (!current) {
    return
  }
  const { resolve } = current
  emit(null)
  resolve('cancel')
}

export function showUnsavedDialog(message?: string): Promise<UnsavedChoice> {
  return new Promise((resolve) => {
    if (current) {
      current.resolve('cancel')
    }
    emit({
      message: message ?? '当前流程有未保存的更改，是否保存？',
      resolve
    })
  })
}

export function UnsavedDialogHost(): JSX.Element | null {
  const [state, setState] = useState<DialogState>(current)

  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  useEffect(() => {
    if (!state) {
      return
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        const { resolve } = state
        emit(null)
        resolve('cancel')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  if (!state) {
    return null
  }

  const choose = (choice: UnsavedChoice): void => {
    const { resolve } = state
    emit(null)
    resolve(choice)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          choose('cancel')
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-[min(420px,calc(100vw-32px))] rounded-lg border border-border bg-panel p-4 shadow-2xl"
      >
        <h2 className="text-sm font-semibold text-primary">未保存的更改</h2>
        <p className="mt-2 text-sm text-secondary">{state.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => choose('cancel')}>
            {ACTION_LABEL.cancel}
          </Button>
          <Button variant="ghost" onClick={() => choose('discard')}>
            {ACTION_LABEL.discard}
          </Button>
          <Button onClick={() => choose('save')}>{ACTION_LABEL.save}</Button>
        </div>
      </div>
    </div>
  )
}
