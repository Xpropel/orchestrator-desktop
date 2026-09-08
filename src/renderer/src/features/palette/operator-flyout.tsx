import { memo, useEffect, type DragEvent, type JSX } from 'react'
import { cn } from '@/ui/cn'
import { resolveIcon } from '@/ui/icons'
import { OPERATOR_DRAG_MIME } from '@/shared/mime'
import { exclusiveAccent, listPaletteByCategory } from '@/core/palette'
import { listCategories } from '@/core/registry'
import type { OperatorDefinition } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'
import { FLYOUT_WIDTH } from './palette-width'

export { FLYOUT_WIDTH }

/** 某一类别下的工具列表，贴在悬浮组件栏旁边；位置由组件栏算好传入。 */
export const OperatorFlyout = memo(function OperatorFlyout({
  onAddOperator,
  left,
  top,
  height,
  side
}: {
  onAddOperator: (type: string) => void
  left: number
  top: number
  height: number
  /** 贴在组件栏的哪一侧，决定强调色边线画在哪条竖边 */
  side: 'left' | 'right'
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
      if (target.closest('[data-testid="operator-palette"]') || target.closest('[data-testid="operator-flyout"]')) {
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
        'pointer-events-auto absolute z-30 flex flex-col overflow-hidden rounded-xl border border-border bg-panel/85 shadow-2xl backdrop-blur-md',
        accent && (side === 'right' ? 'border-l-2' : 'border-r-2')
      )}
      style={{
        left,
        top,
        height,
        width: FLYOUT_WIDTH,
        ...(accent ? (side === 'right' ? { borderLeftColor: accent } : { borderRightColor: accent }) : {})
      }}
    >
      <div className="border-b border-border/70 px-3 py-2">
        <p className="text-xs font-semibold text-primary">{category?.title ?? openCategory}</p>
        <p className="text-[11px] text-secondary">{operators.length} 个工具</p>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
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
