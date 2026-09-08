import { memo, useLayoutEffect, useRef, useState, useEffect } from 'react'
import type { JSX } from 'react'
import { ACTION_LABEL } from '@shared/action-labels'
import { cn } from '@/ui/cn'
import { clampPopover } from '@/ui/clamp-popover'

export type ContextMenuState =
  | { kind: 'node'; x: number; y: number; nodeId: string; isLocked: boolean }
  | { kind: 'pane'; x: number; y: number }

export const ContextMenu = memo(function ContextMenu({
  menu,
  hasClipboard,
  onClose,
  onCopy,
  onDelete,
  onPaste,
  onAddNote,
  onFitView,
  onAutoLayout
}: {
  menu: ContextMenuState
  hasClipboard: boolean
  onClose: () => void
  onCopy: () => void
  onDelete: () => void
  onPaste: () => void
  onAddNote: () => void
  onFitView: () => void
  onAutoLayout: () => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: menu.x, top: menu.y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const rect = el.getBoundingClientRect()
    setPos(clampPopover(menu.x, menu.y, rect.width, rect.height, { width: window.innerWidth, height: window.innerHeight }))
  }, [menu.x, menu.y, menu.kind])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof HTMLElement && target.closest('[data-orchestrator-menu]')) {
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      data-orchestrator-menu
      className="fixed z-50 min-w-[168px] rounded-md border border-border bg-panel py-1 text-sm shadow-xl"
      style={{ left: pos.left, top: pos.top }}
    >
      {menu.kind === 'node' ? (
        <>
          <MenuItem
            label={ACTION_LABEL.copy}
            onClick={() => {
              onCopy()
              onClose()
            }}
          />
          {menu.isLocked ? (
            <MenuItem label="不可删除" disabled />
          ) : (
            <MenuItem
              label={ACTION_LABEL.delete}
              danger
              onClick={() => {
                onDelete()
                onClose()
              }}
            />
          )}
        </>
      ) : (
        <>
          <MenuItem
            label={ACTION_LABEL.paste}
            disabled={!hasClipboard}
            onClick={() => {
              onPaste()
              onClose()
            }}
          />
          <MenuItem
            label={ACTION_LABEL.addNote}
            onClick={() => {
              onAddNote()
              onClose()
            }}
          />
          <MenuItem
            label={ACTION_LABEL.fitView}
            onClick={() => {
              onFitView()
              onClose()
            }}
          />
          <MenuItem
            label={ACTION_LABEL.autoLayout}
            onClick={() => {
              onAutoLayout()
              onClose()
            }}
          />
        </>
      )}
    </div>
  )
})

function MenuItem({
  label,
  disabled,
  danger,
  onClick
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onClick?: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full px-3 py-1.5 text-left text-primary',
        disabled && 'cursor-not-allowed text-secondary/60',
        !disabled && 'hover:bg-elevated',
        danger && !disabled && 'text-red-400 hover:text-red-300'
      )}
    >
      {label}
    </button>
  )
}
