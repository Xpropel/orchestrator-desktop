import { useCallback, useEffect, useState, type JSX } from 'react'
import { ChevronDown, ChevronUp, GripVertical, RotateCcw, Settings2, X } from 'lucide-react'
import { FlowProperties, NodeProperties } from '@/features/inspector/property-panel'
import { ErrorBoundary } from '@/ui/error-boundary'
import { CardHeaderButton, FloatingCard } from '@/ui/floating-card/floating-card'
import type { CardLimits } from '@/ui/floating-card/floating-card-rect'
import { useFloatingCard } from '@/ui/floating-card/use-floating-card'
import { resolveIcon } from '@/ui/icons'
import { getOperator, hasOperator } from '@/core/registry'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'
import { useStableNode } from '@/state/select-node'

/**
 * 悬浮属性面板。
 * - 只在点击节点后出现（拖动/框选/右键只改选中态，不弹面板）；关闭后收成右上角一颗「流程设置」按钮，不占画布空间。
 * - 位置 / 尺寸 / 拖拽由 `useFloatingCard` 管：默认停靠右上，左边缘拉宽、底边拉高、左下角同时改。
 */

const LIMITS: CardLimits = {
  minWidth: 300,
  maxWidth: 640,
  minHeight: 200,
  defaultWidth: 360,
  defaultHeight: 560,
  anchor: 'right'
}

const EDGES = ['left', 'bottom', 'bottom-left'] as const

export function FloatingInspector(): JSX.Element {
  const card = useFloatingCard('orchestrator.inspector.rect', LIMITS)
  const [collapsed, setCollapsed] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)

  const inspectorNodeId = useUiStore((state) => state.inspectorNodeId)
  const closeInspector = useUiStore((state) => state.closeInspector)
  // 节点被删除后面板随之关闭，不残留空壳。
  const inspectedExists = useFlowStore((state) =>
    inspectorNodeId ? state.nodes.some((node) => node.id === inspectorNodeId) : false
  )

  const nodeId = inspectedExists ? inspectorNodeId : null
  const open = nodeId !== null || flowOpen

  // 打开节点时自动展开正文，方便直接编辑。
  useEffect(() => {
    if (nodeId) {
      setCollapsed(false)
    }
  }, [nodeId])

  const close = useCallback(() => {
    setFlowOpen(false)
    closeInspector()
  }, [closeInspector])

  return (
    <div ref={card.overlayRef} className="pointer-events-none absolute inset-x-0 bottom-0 top-toolbar z-20 overflow-hidden">
      {!open ? (
        <button
          type="button"
          title="流程设置"
          onClick={() => setFlowOpen(true)}
          className="pointer-events-auto absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel/80 text-secondary shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:text-primary"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      ) : null}

      {open && card.rect ? (
        <FloatingCard
          key={nodeId ?? 'flow'}
          rect={card.rect}
          maxHeight={card.maxHeight}
          collapsed={collapsed}
          edges={EDGES}
          testId="floating-inspector"
          ariaLabel="属性面板"
          bodyClassName="overflow-y-auto px-3 py-3"
          header={
            <InspectorHeader
              nodeId={nodeId}
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
          <ErrorBoundary
            fallback={
              <p className="text-xs text-secondary">属性面板渲染失败。请改选其他节点，或检查该算子的表单实现。</p>
            }
          >
            {nodeId ? <NodeProperties nodeId={nodeId} showHeader={false} /> : <FlowProperties />}
          </ErrorBoundary>
        </FloatingCard>
      ) : null}
    </div>
  )
}

function InspectorHeader({
  nodeId,
  collapsed,
  onReset,
  onToggleCollapse,
  onClose
}: {
  nodeId: string | null
  collapsed: boolean
  onReset: () => void
  onToggleCollapse: () => void
  onClose: () => void
}): JSX.Element {
  const node = useStableNode(nodeId)
  const operator = node && hasOperator(node.data.label) ? getOperator(node.data.label) : undefined
  const Icon = resolveIcon(operator?.icon ?? (nodeId ? 'Puzzle' : 'Settings2'))
  const color = operator?.color ?? '#94a3b8'
  const title = node ? node.data.name : '流程设置'
  const subtitle = node ? (operator?.title ?? node.data.label) : '标题 · 默认连接 · 全局变量'

  return (
    <>
      <GripVertical className="h-4 w-4 shrink-0 text-secondary/70" />
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${color}22`, color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-medium text-primary">{title}</p>
        <p className="truncate text-[11px] text-secondary">{subtitle}</p>
      </div>
      {operator ? (
        <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-secondary">
          {operator.kind}
        </span>
      ) : null}
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
  )
}
