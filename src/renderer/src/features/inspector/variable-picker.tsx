import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { getAvailableVariables, isTypeCompatible, type AvailableVariable, type VariableScope } from '@/core/variables'
import { resolveAcceptTypes } from '@/core/variables'
import type { ParamField, VarType } from '@/core/schema'
import { useFlowStore } from '@/state/flow-store'

const SCOPE_LABEL: Record<VariableScope, string> = {
  upstream: '上游',
  container: '容器',
  global: '全局'
}

const SCOPE_ORDER: VariableScope[] = ['upstream', 'container', 'global']

function formatVariableRef(item: AvailableVariable): string {
  return `{{${item.nodeName}.${item.variable.name}}}`
}

function TypeBadge({ type }: { type: VarType }): JSX.Element {
  return (
    <span className="rounded bg-elevated px-1 py-px text-[10px] uppercase tracking-wide text-secondary">{type}</span>
  )
}

export function VariablePicker({
  nodeId,
  accept,
  value,
  onSelect,
  allowEmpty = true
}: {
  nodeId: string
  accept?: VarType[]
  value?: string
  onSelect: (next: string) => void
  allowEmpty?: boolean
}): JSX.Element {
  const nodes = useFlowStore((state) => state.nodes)
  const edges = useFlowStore((state) => state.edges)
  const items = useMemo(() => {
    const all = getAvailableVariables(nodeId, nodes, edges)
    if (!accept || accept.length === 0) return all
    return all.filter((item) => isTypeCompatible(item.variable.type, accept))
  }, [accept, edges, nodeId, nodes])

  const grouped = SCOPE_ORDER.map((scope) => ({
    scope,
    items: items.filter((item) => item.scope === scope)
  })).filter((group) => group.items.length > 0)

  const current = value ?? ''
  const known = current.length === 0 || items.some((item) => formatVariableRef(item) === current)

  return (
    <select
      className="h-8 w-full rounded-md border border-border bg-elevated px-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      value={current}
      onChange={(event) => onSelect(event.target.value)}
    >
      {allowEmpty ? <option value="">（未选择）</option> : null}
      {known ? null : <option value={current}>{`${current} · 当前`}</option>}
      {grouped.map((group) => (
        <optgroup key={group.scope} label={SCOPE_LABEL[group.scope]}>
          {group.items.map((item) => {
            const ref = formatVariableRef(item)
            return (
              <option key={`${item.scope}:${ref}`} value={ref}>
                {`${item.nodeName}.${item.variable.name} · ${item.variable.type}`}
              </option>
            )
          })}
        </optgroup>
      ))}
    </select>
  )
}

export function InsertVariableButton({
  nodeId,
  accept,
  onInsert
}: {
  nodeId: string
  accept?: VarType[]
  onInsert: (ref: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const nodes = useFlowStore((state) => state.nodes)
  const edges = useFlowStore((state) => state.edges)
  const items = useMemo(() => {
    const all = getAvailableVariables(nodeId, nodes, edges)
    if (!accept || accept.length === 0) return all
    return all.filter((item) => isTypeCompatible(item.variable.type, accept))
  }, [accept, edges, nodeId, nodes])
  const grouped = SCOPE_ORDER.map((scope) => ({
    scope,
    items: items.filter((item) => item.scope === scope)
  })).filter((group) => group.items.length > 0)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-secondary hover:bg-elevated hover:text-primary"
        onClick={() => setOpen((value) => !value)}
      >
        插入变量
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border border-border bg-panel p-1 shadow-lg">
          {grouped.length === 0 ? (
            <p className="px-2 py-1.5 text-[11px] text-secondary">没有可用变量</p>
          ) : (
            grouped.map((group) => (
              <div key={group.scope} className="mb-1">
                <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-secondary">
                  {SCOPE_LABEL[group.scope]}
                </p>
                {group.items.map((item) => {
                  const ref = formatVariableRef(item)
                  return (
                    <button
                      key={`${item.scope}:${ref}`}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-elevated"
                      onClick={() => {
                        onInsert(ref)
                        setOpen(false)
                      }}
                    >
                      <span className="truncate text-primary">
                        {item.nodeName}.{item.variable.name}
                      </span>
                      <TypeBadge type={item.variable.type} />
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

export function acceptFromField(field: ParamField): VarType[] {
  return resolveAcceptTypes(field.extra)
}
