import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  CARD_HEADER_HEIGHT,
  applyResize,
  clampRect,
  defaultRect,
  maxHeightFor,
  readStoredRect,
  sameRect,
  storeRect,
  type CardLimits,
  type CardRect,
  type ResizeEdge,
  type Size
} from './floating-card-rect'

export interface FloatingCardController {
  /** 挂到覆盖层（`position: absolute; inset` 铺满画布容器）上，用来量容器尺寸 */
  overlayRef: (element: HTMLDivElement | null) => void
  container: Size
  rect: CardRect | null
  maxHeight: number
  /** 卡片实际渲染高度，由 `FloatingCard` 上报，用于纵向夹边（内容短或折叠时小于 rect.height） */
  visibleHeight: number
  setVisibleHeight: (height: number) => void
  startDrag: (event: ReactPointerEvent<HTMLElement>) => void
  startResize: (edge: ResizeEdge, event: ReactPointerEvent<HTMLElement>) => void
  reset: () => void
}

/**
 * 悬浮卡片的位置 / 尺寸状态机：标题栏拖动 = 整体平移（碰到容器边缘停住），
 * 边缘拉伸改尺寸；位置记忆到 localStorage，容器缩放时自动夹回可视区。
 */
export function useFloatingCard(storageKey: string, limits: CardLimits): FloatingCardController {
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null)
  const [container, setContainer] = useState<Size>({ width: 0, height: 0 })
  const [rect, setRect] = useState<CardRect | null>(null)
  const [visibleHeight, setVisibleHeightState] = useState(CARD_HEADER_HEIGHT)
  const setVisibleHeight = useCallback((height: number) => {
    const next = Math.max(CARD_HEADER_HEIGHT, Math.round(height))
    setVisibleHeightState((current) => (current === next ? current : next))
  }, [])
  const limitsRef = useRef(limits)
  limitsRef.current = limits

  useLayoutEffect(() => {
    if (!overlay) {
      return
    }
    const measure = (): void => {
      const box = overlay.getBoundingClientRect()
      setContainer({ width: box.width, height: box.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(overlay)
    return () => observer.disconnect()
  }, [overlay])

  useEffect(() => {
    if (container.width === 0) {
      return
    }
    setRect((current) => {
      const base = current ?? readStoredRect(storageKey, limitsRef.current) ?? defaultRect(limitsRef.current, container)
      const next = clampRect(limitsRef.current, base, container, visibleHeight)
      return current !== null && sameRect(next, current) ? current : next
    })
  }, [container, storageKey, visibleHeight])

  /** 通用指针拖拽：把移动量交给 `apply` 计算下一帧 rect，松手时持久化。 */
  const trackPointer = useCallback(
    (event: ReactPointerEvent<HTMLElement>, apply: (dx: number, dy: number, start: CardRect) => CardRect) => {
      if (!rect || event.button !== 0) {
        return
      }
      event.preventDefault()
      const target = event.currentTarget
      const start = rect
      const origin = { x: event.clientX, y: event.clientY }
      let latest = rect
      try {
        target.setPointerCapture(event.pointerId)
      } catch {
        // 元素未连接时 capture 会抛；仍监听 pointerup。
      }

      const onMove = (move: PointerEvent): void => {
        latest = clampRect(
          limitsRef.current,
          apply(move.clientX - origin.x, move.clientY - origin.y, start),
          container,
          visibleHeight
        )
        setRect(latest)
      }
      const onUp = (): void => {
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onUp)
        target.removeEventListener('lostpointercapture', onUp)
        try {
          if (target.hasPointerCapture(event.pointerId)) {
            target.releasePointerCapture(event.pointerId)
          }
        } catch {
          // 窗口外松手或节点已卸载。
        }
        storeRect(storageKey, latest)
      }
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
      target.addEventListener('lostpointercapture', onUp)
    },
    [container, rect, storageKey, visibleHeight]
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
      trackPointer(event, (dx, dy, start) =>
        applyResize(limitsRef.current, edge, dx, dy, start, container, visibleHeight)
      )
    },
    [container, trackPointer, visibleHeight]
  )

  const reset = useCallback(() => {
    if (container.width === 0) {
      return
    }
    setRect(defaultRect(limitsRef.current, container))
    storeRect(storageKey, null)
  }, [container, storageKey])

  return {
    overlayRef: setOverlay,
    container,
    rect,
    maxHeight: maxHeightFor(limits, container),
    visibleHeight,
    setVisibleHeight,
    startDrag,
    startResize,
    reset
  }
}
