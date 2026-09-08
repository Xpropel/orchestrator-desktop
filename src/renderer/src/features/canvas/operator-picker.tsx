import { useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react'
import { ChevronLeft, Search } from 'lucide-react'
import { cn } from '@/ui/cn'
import {
  categoryIconName,
  listPaletteByCategory,
  listPaletteOperators,
  operatorMatchesQuery,
  sortCategoriesForSidebar
} from '@/core/palette'
import { resolveIcon } from '@/ui/icons'
import { listCategories } from '@/core/registry'
import type { OperatorDefinition } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'
import { clampPopover } from '@/ui/clamp-popover'

export type OperatorPickerMode = { kind: 'category'; categoryKey: string } | { kind: 'all' }

interface OperatorPickerProps {
  x: number
  y: number
  mode: OperatorPickerMode
  onSelect: (type: string) => void
  onClose: () => void
}

export function OperatorPicker({ x, y, mode, onSelect, onClose }: OperatorPickerProps): JSX.Element {
  const nodes = useFlowStore((state) => state.nodes)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [drilledKey, setDrilledKey] = useState<string | null>(
    mode.kind === 'category' ? mode.categoryKey : null
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  const categories = useMemo(() => sortCategoriesForSidebar(listCategories()), [])
  const filtered = query.trim().length > 0
  const categoryTitle = categories.find((item) => item.key === drilledKey)?.title

  const operators = useMemo((): OperatorDefinition[] => {
    if (filtered) {
      return listPaletteOperators(nodes).filter((operator) => operatorMatchesQuery(operator, query))
    }
    if (drilledKey) {
      return listPaletteByCategory(drilledKey, nodes)
    }
    return []
  }, [drilledKey, filtered, nodes, query])

  const showCategories = mode.kind === 'all' && !filtered && !drilledKey
  const itemCount = showCategories ? categories.length : operators.length

  useEffect(() => {
    setActiveIndex(0)
  }, [query, drilledKey, showCategories])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos(clampPopover(x, y, rect.width, rect.height, { width: window.innerWidth, height: window.innerHeight }))
  }, [x, y, itemCount])

  useEffect(() => {
    const onPointer = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [onClose])

  const confirm = (index: number): void => {
    if (showCategories) {
      const category = categories[index]
      if (category) setDrilledKey(category.key)
      return
    }
    const operator = operators[index]
    if (operator) onSelect(operator.type)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (mode.kind === 'all' && drilledKey && !filtered) {
        setDrilledKey(null)
        return
      }
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (itemCount === 0 ? 0 : (current + 1) % itemCount))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (itemCount === 0 ? 0 : (current - 1 + itemCount) % itemCount))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      confirm(activeIndex)
    }
  }

  return (
    <div
      ref={rootRef}
      data-testid="operator-picker"
      data-orchestrator-picker
      className="fixed z-50 w-72 overflow-hidden rounded-lg border border-border bg-panel shadow-xl"
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
        {mode.kind === 'all' && drilledKey && !filtered ? (
          <button
            type="button"
            className="rounded p-0.5 text-secondary hover:bg-elevated hover:text-primary"
            onClick={() => setDrilledKey(null)}
            aria-label="返回类别"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <Search className="h-3.5 w-3.5 shrink-0 text-secondary" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={categoryTitle ? `搜索 ${categoryTitle}…` : '搜索算子…'}
          className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-secondary"
        />
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {showCategories
          ? categories.map((category, index) => {
              const Icon = resolveIcon(categoryIconName(category))
              const count = listPaletteByCategory(category.key, nodes).length
              return (
                <li key={category.key}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm',
                      index === activeIndex ? 'bg-elevated text-primary' : 'text-primary hover:bg-elevated'
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => confirm(index)}
                  >
                    <Icon className="h-3.5 w-3.5 text-secondary" />
                    <span className="flex-1 truncate">{category.title}</span>
                    <span className="text-[10px] text-secondary">{count}</span>
                  </button>
                </li>
              )
            })
          : operators.map((operator, index) => {
              const Icon = resolveIcon(operator.icon)
              return (
                <li key={operator.type}>
                  <button
                    type="button"
                    data-testid={`picker-operator-${operator.type}`}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 text-left',
                      index === activeIndex ? 'bg-elevated' : 'hover:bg-elevated'
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => confirm(index)}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${operator.color}22`, color: operator.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-primary">{operator.title}</span>
                      <span className="block truncate text-[11px] text-secondary">{operator.description}</span>
                    </span>
                  </button>
                </li>
              )
            })}
        {itemCount === 0 ? <li className="px-3 py-3 text-xs text-secondary">没有匹配的算子</li> : null}
      </ul>
    </div>
  )
}
