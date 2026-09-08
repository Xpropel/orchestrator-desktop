import type { JSX } from 'react'
import { Trash2 } from 'lucide-react'
import { ACTION_LABEL } from '@shared/action-labels'
import { SchemaForm } from '@/features/inspector/schema-form'
import { Button } from '@/ui/button'
import { Field } from '@/ui/field'
import { DebouncedInput, DebouncedTextarea } from '@/ui/debounced-fields'
import { resolveIcon } from '@/ui/icons'
import { isProtectedNode } from '@/core/graph'
import { getExtensionGlobals } from '@/core/library'
import { getOperator, hasOperator } from '@/core/registry'
import { isRecord } from '@/core/schema'
import { getNodeOutputs } from '@/core/variables'
import { selectNodeIssues, useValidationStore } from '@/state/validation-store'
import { useFlowStore } from '@/state/flow-store'
import { useStableNode } from '@/state/select-node'
import { DownstreamOrder } from './downstream-order'

function stringifyGlobal(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? ''
  } catch {
    return ''
  }
}

function parseGlobalJson(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

/** 属性面板正文（流程 / 节点两种），由 `features/inspector/floating-inspector.tsx` 承载。 */
export function FlowProperties(): JSX.Element {
  const title = useFlowStore((state) => state.title)
  const filePath = useFlowStore((state) => state.filePath)
  const nodeCount = useFlowStore((state) => state.nodes.length)
  const edgeCount = useFlowStore((state) => state.edges.length)
  const globals = useFlowStore((state) => state.globals)
  const nodes = useFlowStore((state) => state.nodes)
  const setTitle = useFlowStore((state) => state.setTitle)
  const setGlobals = useFlowStore((state) => state.setGlobals)
  const revision = useFlowStore((state) => state.revision)
  const starts = nodes.filter((node) => hasOperator(node.data.label) && getOperator(node.data.label).kind === 'start')
  const sections = getExtensionGlobals()
  const sectionKeys = new Set(sections.map((section) => section.key))
  const extraGlobalKeys = Object.keys(globals).filter((key) => !sectionKeys.has(key))

  return (
    <div className="flex flex-col gap-3 text-sm">
      <Field label="标题">
        <DebouncedInput key={`flow-title:${revision}`} value={title} onCommit={setTitle} />
      </Field>
      <div className="rounded-md border border-border bg-elevated/40 px-2.5 py-2 text-xs text-secondary">
        <p>
          节点 <span className="text-primary">{nodeCount}</span>
          <span className="mx-1.5">·</span>
          边 <span className="text-primary">{edgeCount}</span>
        </p>
        <p className="mt-1 break-all">
          文件路径：<span className="text-primary">{filePath ?? '未保存'}</span>
        </p>
      </div>

      {sections.map((section) => {
        const raw = globals[section.key]
        const record = isRecord(raw) ? raw : {}
        return (
          <div key={section.key} className="flex flex-col gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">{section.title}</p>
            {section.fields.map((field) => {
              const rawValue = record[field.key]
              const value = typeof rawValue === 'string' ? rawValue : ''
              return (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <DebouncedInput
                    key={`${section.key}:${field.key}:${revision}`}
                    value={value}
                    onCommit={(next) =>
                      setGlobals({
                        [section.key]: { ...record, [field.key]: next }
                      })
                    }
                  />
                </Field>
              )
            })}
          </div>
        )
      })}

      {extraGlobalKeys.map((key) => (
        <Field key={key} label={`globals.${key}`} hint="JSON">
          <DebouncedTextarea
            key={`globals-json:${key}:${revision}`}
            value={stringifyGlobal(globals[key])}
            onCommit={(next) => {
              const parsed = parseGlobalJson(next)
              if (parsed === undefined && next.trim().length > 0) return
              setGlobals({ [key]: parsed })
            }}
          />
        </Field>
      ))}

      <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">全局变量</p>
      <ul className="flex flex-col gap-1 rounded-md border border-border bg-elevated/40 px-2.5 py-2 text-xs">
        <li className="flex justify-between gap-2">
          <span className="font-mono text-primary">sys.query</span>
          <span className="text-secondary">string</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="font-mono text-primary">sys.files</span>
          <span className="text-secondary">array</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="font-mono text-primary">sys.now</span>
          <span className="text-secondary">string</span>
        </li>
        {starts.flatMap((start) =>
          getNodeOutputs(start).map((item) => (
            <li key={`${start.id}:${item.name}`} className="flex justify-between gap-2">
              <span className="font-mono text-primary">
                {start.data.name}.{item.name}
              </span>
              <span className="text-secondary">{item.type}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

/** 节点属性正文。`showHeader=false` 时由外层（悬浮面板标题栏）负责展示图标与类型。 */
export function NodeProperties({
  nodeId,
  showHeader = true
}: {
  nodeId: string
  showHeader?: boolean
}): JSX.Element | null {
  const node = useStableNode(nodeId)
  const nodes = useFlowStore((state) => state.nodes)
  const updateNodeData = useFlowStore((state) => state.updateNodeData)
  const removeNode = useFlowStore((state) => state.removeNode)
  const revision = useFlowStore((state) => state.revision)
  const issues = useValidationStore((state) => selectNodeIssues(state, nodeId))

  if (!node) {
    return null
  }

  const known = hasOperator(node.data.label)
  const operator = known ? getOperator(node.data.label) : undefined
  const Icon = resolveIcon(operator?.icon ?? 'Puzzle')
  const color = operator?.color ?? '#94a3b8'
  const canDelete = operator?.constraints?.deletable !== false && !isProtectedNode(node, nodes)
  const outputs = known ? getNodeOutputs(node) : []

  return (
    <div className="flex flex-col gap-3">
      {showHeader ? (
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ backgroundColor: `${color}22`, color }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-primary">{operator?.title ?? node.data.label}</p>
            <p className="truncate text-[11px] text-secondary">{node.data.label}</p>
          </div>
          {operator ? (
            <span className="ml-auto rounded bg-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-secondary">
              {operator.kind}
            </span>
          ) : null}
        </div>
      ) : null}

      <Field label="名称">
        <DebouncedInput
          key={`${nodeId}:name:${revision}`}
          value={node.data.name}
          onCommit={(name) => updateNodeData(nodeId, { name })}
        />
      </Field>
      <Field label="描述">
        <DebouncedTextarea
          key={`${nodeId}:description:${revision}`}
          value={node.data.description ?? ''}
          onCommit={(description) => updateNodeData(nodeId, { description })}
        />
      </Field>

      <SchemaForm nodeId={nodeId} />

      <DownstreamOrder nodeId={nodeId} />

      {outputs.length > 0 ? (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">输出</p>
          <ul className="flex flex-col gap-1 rounded-md border border-border bg-elevated/40 px-2.5 py-2 text-xs">
            {outputs.map((item) => (
              <li key={item.name} className="flex justify-between gap-2">
                <span className="font-mono text-primary">{item.name}</span>
                <span className="text-secondary">{item.type}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {issues.length > 0 ? (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">问题</p>
          <ul className="flex flex-col gap-1">
            {issues.map((item) => (
              <li
                key={item.id}
                className={item.level === 'error' ? 'text-xs text-red-400' : 'text-xs text-amber-400'}
              >
                <span className="font-mono">[{item.code}]</span> {item.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canDelete ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-secondary">危险区</p>
          <Button variant="danger" className="w-full" onClick={() => removeNode(nodeId)}>
            <Trash2 className="h-3.5 w-3.5" />
            {ACTION_LABEL.deleteNode}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
