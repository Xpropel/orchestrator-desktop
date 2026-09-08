import { memo, useMemo, useState, type DragEvent, type JSX } from 'react'
import { ChevronDown, ChevronUp, GripVertical, LayoutGrid, RotateCcw, Search, X } from 'lucide-react'
import { cn } from '@/ui/cn'
import { CardHeaderButton, FloatingCard } from '@/ui/floating-card/floating-card'
import { CARD_MARGIN, type CardLimits } from '@/ui/floating-card/floating-card-rect'
import { useFloatingCard } from '@/ui/floating-card/use-floating-card'
import { resolveIcon } from '@/ui/icons'
import { CATEGORY_DRAG_MIME, OPERATOR_DRAG_MIME } from '@/shared/mime'
import {
  categoryIconName,
  exclusiveAccent,
  listPaletteByCategory,
  listPaletteOperators,
  operatorMatchesQuery,
  sortCategoriesForSidebar
} from '@/core/palette'
import { listCategories } from '@/core/registry'
import type { OperatorCategory, OperatorDefinition } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'
import { OperatorFlyout } from './operator-flyout'
import {
  PALETTE_DEFAULT_WIDTH,
  PALETTE_MAX_WIDTH,
  PALETTE_RAIL_WIDTH,
  isRailWidth,
  placeOperatorFlyout,
  snapPaletteWidth
} from './palette-width'

/**
 * 悬浮组件栏：与属性面板同一套玻璃卡片。默认停靠左上，右边缘拉宽、底边拉高；
 * 拉到窄于阈值时吸附成仅图标的窄栏，点类别仍在卡片旁弹出该类工具。
 */

const LIMITS: CardLimits = {
  minWidth: PALETTE_RAIL_WIDTH,
  maxWidth: PALETTE_MAX_WIDTH,
  minHeight: 160,
  defaultWidth: PALETTE_DEFAULT_WIDTH,
  defaultHeight: 520,
  anchor: 'left',
  snapWidth: snapPaletteWidth
}

const EDGES = ['right', 'bottom', 'bottom-right'] as const

export function FloatingPalette({ onAddOperator }: { onAddOperator: (type: string) => void }): JSX.Element {
  const card = useFloatingCard('orchestrator.palette.rect', LIMITS)
  const [open, setOpen] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const openCategory = useUiStore((state) => state.openCategory)
  const setOpenCategory = useUiStore((state) => state.setOpenCategory)

  const rect = card.rect
  const rail = rect ? isRailWidth(rect.width) : false

  // 飞出面板贴在卡片旁；右侧放不下就翻到左侧，靠近底边时上移以免溢出。
  const flyoutStyle = useMemo(() => {
    if (!rect) return null
    return placeOperatorFlyout(rect, card.container, card.visibleHeight, CARD_MARGIN)
  }, [card.container, card.visibleHeight, rect])

  const close = (): void => {
    setOpen(false)
    setOpenCategory(null)
  }

  return (
    <div ref={card.overlayRef} className="pointer-events-none absolute inset-x-0 bottom-0 top-toolbar z-20 overflow-hidden">
      {!open ? (
        <button
          type="button"
          title="组件栏"
          data-testid="palette-open"
          onClick={() => setOpen(true)}
          className="pointer-events-auto absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel/80 text-secondary shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:text-primary"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      ) : null}

      {open && rect ? (
        <FloatingCard
          rect={rect}
          maxHeight={card.maxHeight}
          collapsed={collapsed}
          edges={EDGES}
          testId="operator-palette"
          ariaLabel="组件栏"
          header={
            <PaletteHeader
              rail={rail}
              collapsed={collapsed}
              onReset={card.reset}
              onToggleCollapse={() => setCollapsed((value) => !value)}
              onClose={close}
            />
          }
          onVisibleHeight={card.setVisibleHeight}
          onDragStart={card.startDrag}
          onResizeStart={card.startResize}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        >
          <PaletteBody rail={rail} onAddOperator={onAddOperator} />
        </FloatingCard>
      ) : null}

      {open && !collapsed && openCategory && flyoutStyle ? (
        <OperatorFlyout onAddOperator={onAddOperator} {...flyoutStyle} />
      ) : null}
    </div>
  )
}

function PaletteHeader({
  rail,
  collapsed,
  onReset,
  onToggleCollapse,
  onClose
}: {
  rail: boolean
  collapsed: boolean
  onReset: () => void
  onToggleCollapse: () => void
  onClose: () => void
}): JSX.Element {
  return (
    <>
      <GripVertical className="h-4 w-4 shrink-0 text-secondary/70" />
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent"
        title={rail ? '组件栏（向右拖边缘展开文字）' : undefined}
      >
        <LayoutGrid className="h-4 w-4" />
      </span>
      {rail ? null : (
        <>
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-primary" title="点击类别或直接拖到画布">
            组件
          </p>
          <CardHeaderButton title="重置位置与大小" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </CardHeaderButton>
          <CardHeaderButton title={collapsed ? '展开' : '折叠'} onClick={onToggleCollapse}>
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </CardHeaderButton>
          <CardHeaderButton title="关闭" onClick={onClose}>
            <X className="h-4 w-4" />
          </CardHeaderButton>
        </>
      )}
    </>
  )
}

const PaletteBody = memo(function PaletteBody({
  rail,
  onAddOperator
}: {
  rail: boolean
  onAddOperator: (type: string) => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const nodes = useFlowStore((state) => state.nodes)
  const openCategory = useUiStore((state) => state.openCategory)
  const setOpenCategory = useUiStore((state) => state.setOpenCategory)
  const normalized = query.trim()
  const searching = !rail && normalized.length > 0

  const categories = useMemo(() => sortCategoriesForSidebar(listCategories()), [])

  const searchHits = useMemo(() => {
    if (!searching) return []
    return listPaletteOperators(nodes)
      .filter((operator) => operatorMatchesQuery(operator, normalized))
      .map((operator) => ({
        operator,
        categoryTitle: categories.find((item) => item.key === operator.category)?.title ?? operator.category
      }))
  }, [categories, nodes, normalized, searching])

  return (
    <>
      {rail ? null : (
        <div className="shrink-0 border-b border-border/70 px-2 py-2">
          <label className="flex items-center gap-1.5 rounded-md border border-border bg-base/60 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-secondary" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                if (event.target.value.trim()) {
                  setOpenCategory(null)
                }
              }}
              placeholder="搜索算子…"
              className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-secondary"
            />
          </label>
        </div>
      )}
      <div className={cn('min-h-0 flex-1 overflow-y-auto py-2', rail ? 'px-3' : 'px-2')}>
        {searching ? (
          searchHits.length === 0 ? (
            <p className="px-1.5 py-3 text-xs text-secondary">没有匹配的算子</p>
          ) : (
            <ul className="space-y-0.5">
              {searchHits.map(({ operator, categoryTitle }) => (
                <SearchHit
                  key={operator.type}
                  operator={operator}
                  categoryTitle={categoryTitle}
                  onAdd={() => onAddOperator(operator.type)}
                />
              ))}
            </ul>
          )
        ) : (
          <ul className="space-y-0.5">
            {categories.map((category) => (
              <CategoryRow
                key={category.key}
                category={category}
                count={listPaletteByCategory(category.key, nodes).length}
                rail={rail}
                active={openCategory === category.key}
                onToggle={() => setOpenCategory(openCategory === category.key ? null : category.key)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
})

function CategoryRow({
  category,
  count,
  rail,
  active,
  onToggle
}: {
  category: OperatorCategory
  count: number
  rail: boolean
  active: boolean
  onToggle: () => void
}): JSX.Element {
  const Icon = resolveIcon(categoryIconName(category))
  const accent = exclusiveAccent(category)
  return (
    <li>
      <button
        type="button"
        draggable
        data-testid={`category-${category.key}`}
        title={rail ? `${category.title} · ${count}` : undefined}
        onDragStart={(event: DragEvent<HTMLButtonElement>) => {
          event.dataTransfer.setData(CATEGORY_DRAG_MIME, category.key)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onClick={onToggle}
        className={cn(
          'flex cursor-grab items-center rounded-md text-left text-sm',
          rail ? 'h-8 w-8 justify-center' : 'w-full gap-2 px-2 py-1.5',
          active ? 'bg-elevated text-primary' : 'text-primary hover:bg-elevated'
        )}
        style={accent ? { boxShadow: `inset 0 0 0 1px ${accent}66` } : undefined}
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            !accent && 'bg-elevated text-secondary'
          )}
          style={accent ? { backgroundColor: `${accent}26`, color: accent } : undefined}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {rail ? null : (
          <>
            <span className="min-w-0 flex-1 truncate">{category.title}</span>
            <span
              className={cn('rounded-full px-1.5 text-[10px] tabular-nums', !accent && 'bg-base text-secondary')}
              style={accent ? { backgroundColor: `${accent}33`, color: accent } : undefined}
            >
              {count}
            </span>
          </>
        )}
      </button>
    </li>
  )
}

const SearchHit = memo(function SearchHit({
  operator,
  categoryTitle,
  onAdd
}: {
  operator: OperatorDefinition
  categoryTitle: string
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
      className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-elevated active:cursor-grabbing"
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${operator.color}22`, color: operator.color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate leading-tight">{operator.title}</span>
        <span className="block truncate text-[11px] leading-tight text-secondary">{categoryTitle}</span>
      </span>
    </li>
  )
})
