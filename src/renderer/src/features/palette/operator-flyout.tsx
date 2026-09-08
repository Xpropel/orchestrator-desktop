import { memo, useEffect, type DragEvent, type JSX } from 'react'
import { cn } from '@/ui/cn'
import { resolveIcon } from '@/ui/icons'
import { OPERATOR_DRAG_MIME } from '@/shared/mime'
import { exclusiveAccent, listPaletteByCategory } from '@/core/palette'
import { listCategories } from '@/core/registry'
import type { OperatorDefinition } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'

export const OperatorFlyout = memo(function OperatorFlyout({
  onAddOperator
}: {
  onAddOperator: (type: string) => void
}): JSX.Element | null {
  const openCategory = useUiStore((state) => state.openCategory)
  const setOpenCategory = useUiStore((state) => state.setOpenCategory)
  const nodes = useFlowStore((state) => state.nodes)

  useEffect(() => {
    if (!openCategory) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpenCategory(null)
      }
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) {
        setOpenCategory(null)
        return
      }
      if (target.closest('[data-testid="operator-sidebar"]') || target.closest('[data-testid="operator-flyout"]')) {
        return
      }
      setOpenCategory(null)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [openCategory, setOpenCategory])

  if (!openCategory) return null

  const category = listCategories().find((item) => item.key === openCategory)
  const operators = listPaletteByCategory(openCategory, nodes)
  const accent = exclusiveAccent(category)

  return (
    <aside
      data-testid="operator-flyout"
      className={cn(
        'absolute left-full top-0 z-30 flex h-full w-[280px] flex-col border-r border-border bg-panel shadow-xl',
        accent && 'border-l-2'
      )}
      style={accent ? { borderLeftColor: accent } : undefined}
    >
      <div className="border-b border-border px-3 py-2">
        <p className="text-xs font-semibold text-primary">{category?.title ?? openCategory}</p>
        <p className="text-[11px] text-secondary">{operators.length} 个工具</p>
      </div>
      <ul className="flex-1 overflow-y-auto px-2 py-2">
        {operators.length === 0 ? (
          <li className="px-1.5 py-3 text-xs text-secondary">该类暂无可用工具</li>
        ) : (
          operators.map((operator) => (
            <FlyoutItem
              key={operator.type}
              operator={operator}
              onAdd={() => {
                onAddOperator(operator.type)
                setOpenCategory(null)
              }}
            />
          ))
        )}
      </ul>
    </aside>
  )
})

const FlyoutItem = memo(function FlyoutItem({
  operator,
  onAdd
}: {
  operator: OperatorDefinition
  onAdd: () => void
}): JSX.Element {
  const Icon = resolveIcon(operator.icon)

  const onDragStart = (event: DragEvent<HTMLLIElement>): void => {
    event.dataTransfer.setData(OPERATOR_DRAG_MIME, operator.type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <li
      draggable
      data-testid={`operator-${operator.type}`}
      onDragStart={onDragStart}
      onClick={onAdd}
      className="mb-0.5 flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-elevated active:cursor-grabbing"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${operator.color}22`, color: operator.color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate leading-tight">{operator.title}</span>
        <span className="block truncate text-[11px] leading-tight text-secondary">{operator.description}</span>
      </span>
    </li>
  )
})
