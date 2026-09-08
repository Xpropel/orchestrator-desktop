/** 悬浮卡片（属性面板、组件栏）的几何逻辑：夹边、拉伸、默认位置、localStorage 记忆。纯函数，便于测试。 */

export interface CardRect {
  x: number
  y: number
  width: number
  /** 卡片高度。`fixedHeight=false` 时它只是上限（内容短则随内容收缩）；用户手动拉过高度后变为固定高度。 */
  height: number
  fixedHeight: boolean
}

export interface Size {
  width: number
  height: number
}

export type ResizeEdge = 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right'

export interface CardLimits {
  minWidth: number
  maxWidth: number
  minHeight: number
  defaultWidth: number
  defaultHeight: number
  /** 默认停靠在容器的哪一侧（也决定拉伸时固定哪条竖边） */
  anchor: 'left' | 'right'
  /** 宽度吸附：拉伸/夹边后的宽度先经它修正（例如组件栏窄于阈值时吸到仅图标栏） */
  snapWidth?: (width: number) => number
}

export const CARD_MARGIN = 12
export const CARD_HEADER_HEIGHT = 44

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function maxWidthFor(limits: CardLimits, container: Size): number {
  return Math.min(limits.maxWidth, Math.max(limits.minWidth, container.width - CARD_MARGIN * 2))
}

export function maxHeightFor(limits: CardLimits, container: Size): number {
  return Math.max(limits.minHeight, container.height - CARD_MARGIN * 2)
}

function settleWidth(limits: CardLimits, width: number, container: Size): number {
  const clamped = clamp(width, limits.minWidth, maxWidthFor(limits, container))
  return limits.snapWidth ? clamp(limits.snapWidth(clamped), limits.minWidth, maxWidthFor(limits, container)) : clamped
}

export function defaultRect(limits: CardLimits, container: Size): CardRect {
  const width = Math.min(limits.defaultWidth, maxWidthFor(limits, container))
  const height = Math.min(limits.defaultHeight, maxHeightFor(limits, container))
  const x = limits.anchor === 'right' ? container.width - width - CARD_MARGIN : CARD_MARGIN
  return { x, y: CARD_MARGIN, width, height, fixedHeight: false }
}

/**
 * 夹回可视区。`visibleHeight` 是卡片当前实际渲染高度（内容短时小于 rect.height，折叠时只剩标题栏）。
 * 用它而不是 rect.height 做纵向限制，拖动时卡片才不会被“钉”在底边。
 */
export function clampRect(limits: CardLimits, rect: CardRect, container: Size, visibleHeight: number): CardRect {
  const width = settleWidth(limits, rect.width, container)
  const height = clamp(rect.height, limits.minHeight, maxHeightFor(limits, container))
  const occupied = Math.min(Math.max(visibleHeight, CARD_HEADER_HEIGHT), height)
  return {
    width,
    height,
    fixedHeight: rect.fixedHeight,
    x: clamp(rect.x, CARD_MARGIN, container.width - width - CARD_MARGIN),
    y: clamp(rect.y, CARD_MARGIN, container.height - occupied - CARD_MARGIN)
  }
}

export function sameRect(a: CardRect, b: CardRect): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.fixedHeight === b.fixedHeight
  )
}

/** 拉伸：竖边拉宽时另一条竖边固定不动；底边从当前可见高度出发，之后高度固定。 */
export function applyResize(
  limits: CardLimits,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  start: CardRect,
  container: Size,
  visibleHeight: number
): CardRect {
  const next: CardRect = { ...start }
  if (edge === 'left' || edge === 'bottom-left') {
    const rightEdge = start.x + start.width
    const width = settleWidth(limits, Math.min(start.width - dx, rightEdge - CARD_MARGIN), container)
    next.width = width
    next.x = rightEdge - width
  }
  if (edge === 'right' || edge === 'bottom-right') {
    next.width = settleWidth(limits, Math.min(start.width + dx, container.width - start.x - CARD_MARGIN), container)
  }
  if (edge === 'bottom' || edge === 'bottom-left' || edge === 'bottom-right') {
    const base = start.fixedHeight ? start.height : Math.min(start.height, visibleHeight)
    next.height = Math.max(limits.minHeight, base + dy)
    next.fixedHeight = true
  }
  return next
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function readStoredRect(storageKey: string, limits: CardLimits): CardRect | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
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
      height: isFiniteNumber(rect.height) ? rect.height : limits.defaultHeight,
      fixedHeight: rect.fixedHeight === true
    }
  } catch {
    return null
  }
}

export function storeRect(storageKey: string, rect: CardRect | null): void {
  try {
    if (rect) {
      window.localStorage.setItem(storageKey, JSON.stringify(rect))
    } else {
      window.localStorage.removeItem(storageKey)
    }
  } catch {
    // 记忆位置只是锦上添花。
  }
}
