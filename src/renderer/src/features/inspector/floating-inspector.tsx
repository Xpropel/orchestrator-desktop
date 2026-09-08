import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { ChevronDown, ChevronUp, GripVertical, RotateCcw, Settings2, X } from 'lucide-react'
import { FlowProperties, NodeProperties } from '@/features/inspector/property-panel'
import { ErrorBoundary } from '@/ui/error-boundary'
import { cn } from '@/ui/cn'
import { resolveIcon } from '@/ui/icons'
import { getOperator, hasOperator } from '@/core/registry'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'
import { useStableNode } from '@/state/select-node'

/**
 * 悬浮属性面板。
 * - 只在点击节点后出现（拖动/框选/右键只改选中态，不弹面板）；关闭后收成右上角一颗「流程设置」按钮，不占画布空间。
 * - 卡片拥有独立的位置与尺寸：标题栏拖动 = 整体平移（碰到画布边缘停住，不改尺寸）；
 *   左边缘拉宽、底边拉高、左下角同时改；位置/尺寸记忆到 localStorage，容器缩放时自动夹回可视区。
 * - 挂在画布容器内（容器需 `position: relative`），不占据整栏。
 */

const STORAGE_KEY = 'orchestrator.inspector.rect'
const MARGIN = 12
const MIN_WIDTH = 300
const MAX_WIDTH = 640
const MIN_HEIGHT = 200
const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 560
const HEADER_HEIGHT = 44

interface InspectorRect {
  x: number
  y: number
  width: number
  /** 卡片高度。`fixedHeight=false` 时它只是上限（内容短则随内容收缩）；用户手动拉过高度后变为固定高度。 */
  height: number
  fixedHeight: boolean
}

interface Size {
  width: number
  height: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function readStoredRect(): InspectorRect | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const rect = parsed as Record<string, unknown>
    if (!isFiniteNumber(rect.x) || !isFiniteNumber(rect.y) || !isFiniteNumber(rect.width)) {
      return null
    }
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: isFiniteNumber(rect.height) ? rect.height : DEFAULT_HEIGHT,
      fixedHeight: rect.fixedHeight === true
    }
  } catch {
    return null
  }
}

function storeRect(rect: InspectorRect | null): void {
  try {
    if (rect) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rect))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // 记忆位置只是锦上添花。
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function maxWidthFor(container: Size): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, container.width - MARGIN * 2))
}

function maxHeightFor(container: Size): number {
  return Math.max(MIN_HEIGHT, container.height - MARGIN * 2)
}

function defaultRect(container: Size): InspectorRect {
  const width = Math.min(DEFAULT_WIDTH, maxWidthFor(container))
  const height = Math.min(DEFAULT_HEIGHT, maxHeightFor(container))
  return { x: container.width - width - MARGIN, y: MARGIN, width, height, fixedHeight: false }
}

/**
 * 夹回可视区。`visibleHeight` 是卡片当前实际渲染高度（内容短时小于 rect.height，折叠时只剩标题栏）。
 * 用它而不是 rect.height 做纵向限制，拖动时卡片才不会被“钉”在底边。
 */
function clampRect(rect: InspectorRect, container: Size, visibleHeight: number): InspectorRect {
  const width = clamp(rect.width, MIN_WIDTH, maxWidthFor(container))
  const height = clamp(rect.height, MIN_HEIGHT, maxHeightFor(container))
  const occupied = Math.min(Math.max(visibleHeight, HEADER_HEIGHT), height)
  return {
    width,
    height,
    fixedHeight: rect.fixedHeight,
    x: clamp(rect.x, MARGIN, container.width - width - MARGIN),
    y: clamp(rect.y, MARGIN, container.height - occupied - MARGIN)
  }
}

type ResizeEdge = 'left' | 'bottom' | 'corner'

export function FloatingInspector(): JSX.Element {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [container, setContainer] = useState<Size>({ width: 0, height: 0 })
  const [rect, setRect] = useState<InspectorRect | null>(null)
  const [visibleHeight, setVisibleHeight] = useState(HEADER_HEIGHT)
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

  // 测量容器，窗口缩放时夹回可视区。
  useLayoutEffect(() => {
    const element = overlayRef.current
    if (!element) {
      return
    }
    const measure = (): void => {
      const box = element.getBoundingClientRect()
      setContainer({ width: box.width, height: box.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (container.width === 0) {
      return
    }
    setRect((current) => {
      const base = current ?? readStoredRect() ?? defaultRect(container)
      const next = clampRect(base, container, visibleHeight)
      const unchanged =
        current !== null &&
        next.x === current.x &&
        next.y === current.y &&
        next.width === current.width &&
        next.height === current.height &&
        next.fixedHeight === current.fixedHeight
      return unchanged ? current : next
    })
  }, [container, visibleHeight])

  // 打开节点时自动展开正文，方便直接编辑。
  useEffect(() => {
    if (nodeId) {
      setCollapsed(false)
    }
  }, [nodeId])

  /** 通用指针拖拽：把移动量交给 `apply` 计算下一帧 rect，松手时持久化。 */
  const trackPointer = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      apply: (dx: number, dy: number, start: InspectorRect) => InspectorRect
    ) => {
      if (!rect || event.button !== 0) {
        return
      }
      event.preventDefault()
      const target = event.currentTarget
      const start = rect
      const origin = { x: event.clientX, y: event.clientY }
      let latest = rect
      target.setPointerCapture(event.pointerId)

      const onMove = (move: PointerEvent): void => {
        latest = clampRect(apply(move.clientX - origin.x, move.clientY - origin.y, start), container, visibleHeight)
        setRect(latest)
      }
      const onUp = (): void => {
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onUp)
        storeRect(latest)
      }
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
    },
    [container, rect, visibleHeight]
  )

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      trackPointer(event, (dx, dy, start) => ({ ...start, x: start.x + dx, y: start.y + dy }))
    },
    [trackPointer]
  )

  const startResize = useCallback(
    (edge: ResizeEdge, event: ReactPointerEvent<HTMLElement>) => {
      event.stopPropagation()
      trackPointer(event, (dx, dy, start) => {
        const rightEdge = start.x + start.width
        const next: InspectorRect = { ...start }
        if (edge === 'left' || edge === 'corner') {
          const width = clamp(start.width - dx, MIN_WIDTH, Math.min(MAX_WIDTH, rightEdge - MARGIN))
          next.width = width
          next.x = rightEdge - width
        }
        if (edge === 'bottom' || edge === 'corner') {
          // 从当前可见高度出发拉伸，手感与鼠标一致；之后高度固定，不再随内容收缩。
          const base = start.fixedHeight ? start.height : Math.min(start.height, visibleHeight)
          next.height = Math.max(MIN_HEIGHT, base + dy)
          next.fixedHeight = true
        }
        return next
      })
    },
    [trackPointer, visibleHeight]
  )

  const resetPosition = useCallback(() => {
    if (container.width === 0) {
      return
    }
    setRect(defaultRect(container))
    storeRect(null)
  }, [container])

  const close = useCallback(() => {
    setFlowOpen(false)
    closeInspector()
  }, [closeInspector])

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {!open ? (
        <button
          type="button"
          title="流程设置"
          onClick={() => setFlowOpen(true)}
          className="pointer-events-auto absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel/90 text-secondary shadow-lg backdrop-blur transition-all duration-200 hover:scale-105 hover:text-primary"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      ) : null}

      {open && rect ? (
        <InspectorCard
          key={nodeId ?? 'flow'}
          rect={rect}
          maxHeight={maxHeightFor(container)}
          collapsed={collapsed}
          nodeId={nodeId}
          onVisibleHeight={setVisibleHeight}
          onDragStart={startDrag}
          onResizeStart={startResize}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onReset={resetPosition}
          onClose={close}
        />
      ) : null}
    </div>
  )
}

interface InspectorCardProps {
  rect: InspectorRect
  maxHeight: number
  collapsed: boolean
  nodeId: string | null
  onVisibleHeight: (height: number) => void
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeStart: (edge: ResizeEdge, event: ReactPointerEvent<HTMLElement>) => void
  onToggleCollapse: () => void
  onReset: () => void
  onClose: () => void
}

function InspectorCard({
  rect,
  maxHeight,
  collapsed,
  nodeId,
  onVisibleHeight,
  onDragStart,
  onResizeStart,
  onToggleCollapse,
  onReset,
  onClose
}: InspectorCardProps): JSX.Element {
  const cardRef = useRef<HTMLElement>(null)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  // 上报实际渲染高度（内容短 / 折叠时小于 rect.height），供父级做纵向夹边。
  useLayoutEffect(() => {
    const element = cardRef.current
    if (!element) {
      return
    }
    const report = (): void => onVisibleHeight(element.getBoundingClientRect().height)
    report()
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => observer.disconnect()
  }, [onVisibleHeight])

  const node = useStableNode(nodeId)
  const operator = node && hasOperator(node.data.label) ? getOperator(node.data.label) : undefined
  const Icon = resolveIcon(operator?.icon ?? (nodeId ? 'Puzzle' : 'Settings2'))
  const color = operator?.color ?? '#94a3b8'
  const title = node ? node.data.name : '流程设置'
  const subtitle = node ? (operator?.title ?? node.data.label) : '标题 · 默认连接 · 全局变量'

  return (
    <section
      ref={cardRef}
      role="dialog"
      aria-label={title}
      data-testid="floating-inspector"
      className={cn(
        'pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border border-border bg-panel/95 text-sm shadow-2xl backdrop-blur',
        'transition-[opacity,transform] duration-200 ease-out',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      )}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        // 用户手动拉过高度 → 固定高度；否则只作为上限，内容短时随内容收缩。
        ...(collapsed
          ? { maxHeight: HEADER_HEIGHT }
          : rect.fixedHeight
            ? { height: Math.min(rect.height, maxHeight) }
            : { maxHeight: Math.min(rect.height, maxHeight) })
      }}
    >
      <div
        onPointerDown={onDragStart}
        onDoubleClick={onToggleCollapse}
        className="flex h-11 shrink-0 cursor-grab select-none items-center gap-2 border-b border-border/70 px-2 active:cursor-grabbing"
      >
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
        <HeaderButton title="重置位置与大小" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" />
        </HeaderButton>
        <HeaderButton title={collapsed ? '展开' : '折叠'} onClick={onToggleCollapse}>
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </HeaderButton>
        <HeaderButton title="关闭" onClick={onClose}>
          <X className="h-4 w-4" />
        </HeaderButton>
      </div>

      {!collapsed ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <ErrorBoundary
            fallback={
              <p className="text-xs text-secondary">属性面板渲染失败。请改选其他节点，或检查该算子的表单实现。</p>
            }
          >
            {nodeId ? <NodeProperties nodeId={nodeId} showHeader={false} /> : <FlowProperties />}
          </ErrorBoundary>
        </div>
      ) : null}

      {!collapsed ? (
        <>
          <div
            onPointerDown={(event) => onResizeStart('left', event)}
            title="拖动调整宽度"
            className="absolute bottom-4 left-0 top-11 w-2 cursor-ew-resize hover:bg-accent/40"
          />
          <div
            onPointerDown={(event) => onResizeStart('bottom', event)}
            title="拖动调整高度"
            className="absolute bottom-0 left-4 right-4 h-2.5 cursor-ns-resize hover:bg-accent/40"
          />
          <div
            onPointerDown={(event) => onResizeStart('corner', event)}
            title="拖动调整大小"
            className="absolute bottom-0 left-0 h-4 w-4 cursor-nesw-resize rounded-bl-xl hover:bg-accent/60"
          />
        </>
      ) : null}
    </section>
  )
}

function HeaderButton({
  title,
  onClick,
  children
}: {
  title: string
  onClick: () => void
  children: JSX.Element
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-secondary transition-colors hover:bg-elevated hover:text-primary"
    >
      {children}
    </button>
  )
}
