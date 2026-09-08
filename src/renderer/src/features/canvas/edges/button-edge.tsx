import { memo, useRef, useState } from 'react'
import type { JSX } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useViewport,
  type EdgeProps
} from '@xyflow/react'
import { X } from 'lucide-react'
import { ACTION_LABEL } from '@shared/action-labels'
import { cn } from '@/ui/cn'
import { useFlowStore } from '@/state/flow-store'

const SELECTED_MARKER_ID = 'orch-edge-marker-active'

export const ButtonEdge = memo(function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  style
}: EdgeProps): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const { zoom } = useViewport()
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // 与 RAGFlow 编排画布一致：平滑贝塞尔曲线，而不是折线。
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.35
  })

  const showButton = selected || hovered
  const strokeFromStyle = style?.stroke
  const emphasized = selected || hovered
  const stroke = emphasized
    ? 'var(--accent)'
    : typeof strokeFromStyle === 'string'
      ? strokeFromStyle
      : '#6e7681'
  // 选中/悬停时箭头随线变色（React Flow 的 markerEnd 是固定 URL，这里自备一枚强调色箭头）。
  const activeMarkerEnd = emphasized ? `url(#${SELECTED_MARKER_ID})` : markerEnd

  const markHover = (next: boolean): void => {
    if (hideTimer.current !== undefined) {
      clearTimeout(hideTimer.current)
      hideTimer.current = undefined
    }
    if (next) {
      setHovered(true)
      return
    }
    hideTimer.current = setTimeout(() => {
      setHovered(false)
      hideTimer.current = undefined
    }, 160)
  }

  return (
    <>
      <defs>
        <marker
          id={SELECTED_MARKER_ID}
          markerWidth="16"
          markerHeight="16"
          viewBox="-10 -10 20 20"
          markerUnits="strokeWidth"
          orient="auto-start-reverse"
          refX="0"
          refY="0"
        >
          <polyline
            points="-5,-4 0,0 -5,4 -5,-4"
            fill="var(--accent)"
            stroke="var(--accent)"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
      <BaseEdge
        path={edgePath}
        markerEnd={activeMarkerEnd}
        className="transition-[stroke,stroke-width] duration-150"
        style={{
          ...style,
          stroke,
          strokeWidth: selected ? 2.2 : hovered ? 1.8 : 1.4
        }}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="react-flow__edge-interaction"
        onMouseEnter={() => markHover(true)}
        onMouseLeave={() => markHover(false)}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={cn(
            'nodrag nopan absolute flex h-5 w-5 items-center justify-center rounded-full border border-border bg-panel text-secondary shadow',
            'hover:border-accent hover:text-accent',
            showButton ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${1 / zoom})`
          }}
          title={ACTION_LABEL.deleteEdge}
          onMouseEnter={() => markHover(true)}
          onMouseLeave={() => markHover(false)}
          onClick={(event) => {
            event.stopPropagation()
            useFlowStore.getState().removeEdge(id)
          }}
        >
          <X className="h-3 w-3" />
        </button>
      </EdgeLabelRenderer>
    </>
  )
})
