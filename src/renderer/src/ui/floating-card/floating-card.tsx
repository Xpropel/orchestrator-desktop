import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'
import { cn } from '../cn'
import { CARD_HEADER_HEIGHT, type CardRect, type ResizeEdge } from './floating-card-rect'

interface FloatingCardProps {
  rect: CardRect
  maxHeight: number
  collapsed: boolean
  /** 渲染哪些拉伸把手；竖边通常只留背离停靠侧的那一条 */
  edges: readonly ResizeEdge[]
  header: ReactNode
  children: ReactNode
  testId: string
  ariaLabel: string
  bodyClassName?: string
  onVisibleHeight: (height: number) => void
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeStart: (edge: ResizeEdge, event: ReactPointerEvent<HTMLElement>) => void
  onToggleCollapse: () => void
}

const EDGE_CLASS: Record<ResizeEdge, string> = {
  left: 'bottom-4 left-0 top-11 w-2 cursor-ew-resize hover:bg-accent/40',
  right: 'bottom-4 right-0 top-11 w-2 cursor-ew-resize hover:bg-accent/40',
  bottom: 'bottom-0 left-4 right-4 h-2.5 cursor-ns-resize hover:bg-accent/40',
  'bottom-left': 'bottom-0 left-0 h-4 w-4 cursor-nesw-resize rounded-bl-xl hover:bg-accent/60',
  'bottom-right': 'bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-br-xl hover:bg-accent/60'
}

const EDGE_TITLE: Record<ResizeEdge, string> = {
  left: '拖动调整宽度',
  right: '拖动调整宽度',
  bottom: '拖动调整高度',
  'bottom-left': '拖动调整大小',
  'bottom-right': '拖动调整大小'
}

/** 玻璃质感悬浮卡片外壳：标题栏拖动、双击折叠、边缘拉伸；几何状态由 `useFloatingCard` 提供。 */
export function FloatingCard({
  rect,
  maxHeight,
  collapsed,
  edges,
  header,
  children,
  testId,
  ariaLabel,
  bodyClassName,
  onVisibleHeight,
  onDragStart,
  onResizeStart,
  onToggleCollapse
}: FloatingCardProps): JSX.Element {
  const cardRef = useRef<HTMLElement>(null)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  // 上报实际渲染高度（内容短 / 折叠时小于 rect.height），供纵向夹边。
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

  return (
    <section
      ref={cardRef}
      role="dialog"
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn(
        'pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border border-border bg-panel/80 text-sm shadow-2xl backdrop-blur-md',
        'transition-[opacity,transform] duration-200 ease-out',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      )}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        // 用户手动拉过高度 → 固定高度；否则只作为上限，内容短时随内容收缩。
        ...(collapsed
          ? { maxHeight: CARD_HEADER_HEIGHT }
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
        {header}
      </div>

      {!collapsed ? <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div> : null}

      {!collapsed
        ? edges.map((edge) => (
            <div
              key={edge}
              onPointerDown={(event) => onResizeStart(edge, event)}
              title={EDGE_TITLE[edge]}
              className={cn('absolute', EDGE_CLASS[edge])}
            />
          ))
        : null}
    </section>
  )
}

export function CardHeaderButton({
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
