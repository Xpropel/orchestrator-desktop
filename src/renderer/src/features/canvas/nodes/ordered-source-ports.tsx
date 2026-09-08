import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { flushSync } from 'react-dom'
import { Position, useStore, useStoreApi, useUpdateNodeInternals } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { HANDLE_START, HANDLE_START_NEW, isLogicalStartHandle, physicalSourceHandle } from '@/core/handles'
import { cn } from '@/ui/cn'
import { useFlowStore } from '@/state/flow-store'
import { FlowHandle } from './flow-handle'

export const SOURCE_PORT_PITCH = 20
export const PORT_CLICK_SLOP = 4

export function orderedPortsMinHeight(occupied: number): number {
  return (occupied + 1) * SOURCE_PORT_PITCH + 16
}

export function orderedPortTop(index: number, occupied: number, extraPx = 0): string {
  return `calc(50% + ${(index - occupied / 2) * SOURCE_PORT_PITCH + extraPx}px)`
}

/** 将 from 插入 hover 后，原 index 所在的新槽位。 */
export function yieldedSlot(from: number, hover: number, index: number, count: number): number {
  if (count <= 0) return 0
  const order = Array.from({ length: count }, (_, i) => i)
  const [moved] = order.splice(from, 1)
  if (moved === undefined) return index
  order.splice(hover, 0, moved)
  const slot = order.indexOf(index)
  return slot < 0 ? index : slot
}

export function hoverSlotFromDelta(from: number, deltaY: number, count: number): number {
  if (count <= 0) return 0
  return Math.max(0, Math.min(count - 1, from + Math.round(deltaY / SOURCE_PORT_PITCH)))
}

export function isClickDisplacement(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < PORT_CLICK_SLOP
}

/** 屏幕位移换算到节点本地 `top`（已含 RF viewport zoom）。 */
export function pointerDeltaToPortOffset(deltaClientY: number, zoom: number): number {
  return deltaClientY / (zoom || 1)
}

export function useStartOutgoingCount(nodeId: string): number {
  return useFlowStore(
    (state) => state.edges.filter((edge) => edge.source === nodeId && isLogicalStartHandle(edge.sourceHandle)).length
  )
}

type PortDrag = {
  edgeId: string
  from: number
  hover: number
  startX: number
  startY: number
  deltaY: number
}

export const OrderedSourcePorts = memo(function OrderedSourcePorts({
  nodeId
}: {
  nodeId: string
}): JSX.Element {
  const outgoingIds = useFlowStore(
    useShallow((state) =>
      state.edges
        .filter((edge) => edge.source === nodeId && isLogicalStartHandle(edge.sourceHandle))
        .map((edge) => edge.id)
    )
  )
  const moveOutgoingEdge = useFlowStore((state) => state.moveOutgoingEdge)
  const updateNodeInternals = useUpdateNodeInternals()
  const rfStore = useStoreApi()
  const occupied = outgoingIds.length
  const measuredKey = useStore((state) => {
    const node = state.nodeLookup.get(nodeId)
    return `${node?.measured?.width ?? node?.width ?? 0}:${node?.measured?.height ?? node?.height ?? 0}`
  })
  const [drag, setDrag] = useState<PortDrag | null>(null)
  const dragRef = useRef<PortDrag | null>(null)
  const moveRaf = useRef(0)

  dragRef.current = drag

  const measureHandles = useCallback(() => {
    const { domNode, updateNodeInternals: apply } = rfStore.getState()
    const nodeElement = domNode?.querySelector(`.react-flow__node[data-id="${nodeId}"]`)
    if (nodeElement instanceof HTMLDivElement) {
      apply(new Map([[nodeId, { id: nodeId, nodeElement, force: true }]]), { triggerFitView: false })
    }
    updateNodeInternals(nodeId)
  }, [nodeId, rfStore, updateNodeInternals])

  useLayoutEffect(() => {
    measureHandles()
  }, [drag, outgoingIds, measuredKey, measureHandles])

  const cancelDrag = useCallback(() => {
    if (moveRaf.current) {
      cancelAnimationFrame(moveRaf.current)
      moveRaf.current = 0
    }
    dragRef.current = null
    setDrag(null)
  }, [])

  const beginDrag = useCallback((clientX: number, clientY: number, from: number) => {
    if (dragRef.current) return
    const edgeId = outgoingIds[from]
    if (!edgeId) return
    const next: PortDrag = {
      edgeId,
      from,
      hover: from,
      startX: clientX,
      startY: clientY,
      deltaY: 0
    }
    dragRef.current = next
    setDrag(next)
  }, [outgoingIds])

  const moveDrag = useCallback((clientY: number) => {
    const current = dragRef.current
    if (!current) return
    const zoom = useFlowStore.getState().viewport.zoom
    const deltaY = pointerDeltaToPortOffset(clientY - current.startY, zoom)
    const hover = hoverSlotFromDelta(current.from, deltaY, occupied)
    if (moveRaf.current) cancelAnimationFrame(moveRaf.current)
    moveRaf.current = requestAnimationFrame(() => {
      moveRaf.current = 0
      const latest = dragRef.current
      if (!latest || latest.edgeId !== current.edgeId) return
      const next = { ...latest, deltaY, hover }
      dragRef.current = next
      setDrag(next)
    })
  }, [occupied])

  const endDrag = useCallback(
    (clientX: number, clientY: number) => {
      const current = dragRef.current
      if (moveRaf.current) {
        cancelAnimationFrame(moveRaf.current)
        moveRaf.current = 0
      }
      if (!current) return
      const zoom = useFlowStore.getState().viewport.zoom
      const deltaY = pointerDeltaToPortOffset(clientY - current.startY, zoom)
      const to = hoverSlotFromDelta(current.from, deltaY, occupied)
      if (isClickDisplacement(clientX - current.startX, clientY - current.startY) || to === current.from) {
        cancelDrag()
        return
      }
      const settled: PortDrag = {
        ...current,
        hover: to,
        deltaY: (to - current.from) * SOURCE_PORT_PITCH
      }
      flushSync(() => {
        dragRef.current = settled
        setDrag(settled)
      })
      measureHandles()
      flushSync(() => {
        moveOutgoingEdge(current.edgeId, to)
        dragRef.current = null
        setDrag(null)
      })
      measureHandles()
    },
    [cancelDrag, measureHandles, moveOutgoingEdge, occupied]
  )

  useEffect(() => {
    if (!drag) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelDrag()
      }
    }
    const onMove = (event: PointerEvent | MouseEvent): void => {
      moveDrag(event.clientY)
    }
    const onUp = (event: PointerEvent | MouseEvent): void => {
      endDrag(event.clientX, event.clientY)
    }
    const onCancel = (): void => {
      cancelDrag()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, cancelDrag, moveDrag, endDrag])

  const onPortPointerDown = useCallback((event: ReactPointerEvent<HTMLSpanElement>, from: number) => {
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    beginDrag(event.clientX, event.clientY, from)
  }, [beginDrag])

  const onPortMouseDown = useCallback((event: ReactMouseEvent<HTMLSpanElement>, from: number) => {
    event.stopPropagation()
    event.preventDefault()
    if (event.button !== 0) return
    beginDrag(event.clientX, event.clientY, from)
  }, [beginDrag])

  const stopBubble = useCallback((event: ReactPointerEvent<HTMLSpanElement> | ReactMouseEvent<HTMLSpanElement>) => {
    event.stopPropagation()
    event.preventDefault()
  }, [])

  return (
    <>
      {Array.from({ length: occupied + 1 }, (_, index) => {
        const rank = index + 1
        const reserved = index === occupied
        const edgeId = outgoingIds[index]
        const dragging = Boolean(edgeId && drag?.edgeId === edgeId)
        const slot = drag && !reserved
          ? (dragging ? drag.from : yieldedSlot(drag.from, drag.hover, index, occupied))
          : index
        const top = reserved
          ? orderedPortTop(occupied, occupied)
          : dragging && drag
            ? orderedPortTop(drag.from, occupied, drag.deltaY)
            : orderedPortTop(slot, occupied)
        return (
          <Fragment key={physicalSourceHandle(HANDLE_START, rank)}>
            {!reserved && (
              <span
                data-testid={`source-port-drag-${rank}`}
                title="拖动可调整顺序"
                className={cn(
                  'nodrag nopan orchestrator-port-hit',
                  dragging && 'orchestrator-port-hit-active'
                )}
                style={{ top }}
                onPointerDown={(event) => onPortPointerDown(event, index)}
                onMouseDown={(event) => onPortMouseDown(event, index)}
                onClick={stopBubble}
              />
            )}
            <FlowHandle
              type="source"
              id={physicalSourceHandle(HANDLE_START, rank)}
              position={Position.Right}
              isConnectableStart={false}
              isConnectableEnd={false}
              className={cn(
                'nodrag nopan',
                reserved ? 'orchestrator-handle-reserved' : 'orchestrator-handle-occupied',
                dragging && 'orchestrator-handle-occupied-active'
              )}
              style={{ top, pointerEvents: 'none', opacity: reserved ? 0 : undefined }}
              title={reserved ? undefined : '拖动可调整顺序'}
              data-testid={reserved ? undefined : `source-port-${rank}`}
            />
          </Fragment>
        )
      })}
      <FlowHandle
        type="source"
        id={HANDLE_START_NEW}
        position={Position.Right}
        isConnectableStart
        isConnectableEnd={false}
        className="nodrag nopan orchestrator-handle-new"
        style={{ top: orderedPortTop(occupied, occupied) }}
        title="拖出以新建连线"
        data-testid="source-port-new"
      />
    </>
  )
})
