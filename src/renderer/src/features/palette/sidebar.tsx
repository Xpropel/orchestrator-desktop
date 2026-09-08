import { memo, useMemo, useState, type DragEvent, type JSX } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/ui/cn'
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
import type { OperatorDefinition } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'

export const Sidebar = memo(function Sidebar({
  onAddOperator
}: {
  onAddOperator: (type: string) => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const nodes = useFlowStore((state) => state.nodes)
  const openCategory = useUiStore((state) => state.openCategory)
  const setOpenCategory = useUiStore((state) => state.setOpenCategory)
  const normalized = query.trim()
  const searching = normalized.length > 0

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
    <aside
      data-testid="operator-sidebar"
      className="flex h-full w-[200px] shrink-0 flex-col border-r border-border bg-panel"
    >
      <div className="flex h-toolbar shrink-0 items-center border-b border-border px-3 text-xs font-medium uppercase tracking-wide text-secondary">
        组件
      </div>
      <div className="border-b border-border px-2 py-2">
        <label className="flex items-center gap-1.5 rounded-md border border-border bg-base px-2 py-1.5">
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
      <div className="flex-1 overflow-y-auto px-2 py-2">
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
            {categories.map((category) => {
              const count = listPaletteByCategory(category.key, nodes).length
              const Icon = resolveIcon(categoryIconName(category))
              const active = openCategory === category.key
              const accent = exclusiveAccent(category)
              return (
                <li key={category.key}>
                  <button
                    type="button"
                    draggable
                    data-testid={`category-${category.key}`}
                    onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                      event.dataTransfer.setData(CATEGORY_DRAG_MIME, category.key)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => setOpenCategory(active ? null : category.key)}
                    className={cn(
                      'flex w-full cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                      active ? 'bg-elevated text-primary' : 'text-primary hover:bg-elevated'
                    )}
                    style={accent ? { boxShadow: `inset 0 0 0 1px ${accent}66` } : undefined}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                        !accent && 'bg-elevated text-secondary'
                      )}
                      style={
                        accent
                          ? { backgroundColor: `${accent}26`, color: accent }
                          : undefined
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{category.title}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[10px] tabular-nums',
                        !accent && 'bg-base text-secondary'
                      )}
                      style={
                        accent
                          ? { backgroundColor: `${accent}33`, color: accent }
                          : undefined
                      }
                    >
                      {count}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
})

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
