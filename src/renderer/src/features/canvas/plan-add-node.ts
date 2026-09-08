import {
  canAddOperator,
  createOperatorNode,
  estimateNodeSize,
  findContainingContainer,
  findNonOverlappingPosition,
  flowCenterFromViewport,
  getNodeCenterOffset,
  toRelativePosition
} from '@/core/graph'
import { getOperator, hasOperator } from '@/core/registry'
import type { FlowNode, XYPosition } from '@/core/types'

export interface PlanAddOptions {
  /** `null` = 强制顶层；省略整个 options 才按落点推断容器。 */
  parentId?: string | null
}

export type PlanAddResult = { ok: false; toast?: string } | { ok: true; node: FlowNode }

const BREAK_TOAST = 'break 只能放在循环容器内'

export function planAddAtFlowPosition(
  type: string,
  center: XYPosition,
  nodes: FlowNode[],
  options?: PlanAddOptions
): PlanAddResult {
  if (!hasOperator(type)) return { ok: false }
  const def = getOperator(type)
  if (def.kind === 'loopStart') return { ok: false }

  const skipParent = def.kind === 'container' || def.kind === 'start'
  const inferParent = options === undefined
  let parentId = skipParent ? undefined : (options?.parentId ?? undefined)
  let position = {
    x: center.x - getNodeCenterOffset(type).x,
    y: center.y - getNodeCenterOffset(type).y
  }

  if (inferParent && !parentId && !skipParent) {
    const hit = findContainingContainer(center, nodes)
    if (hit) {
      parentId = hit.id
      position = toRelativePosition(position, hit, nodes)
    }
  } else if (parentId) {
    const parent = nodes.find((node) => node.id === parentId)
    if (parent) {
      position = toRelativePosition(position, parent, nodes)
    }
  }

  if (!canAddOperator(type, nodes, parentId)) {
    if (def.constraints?.onlyInsideContainer && !parentId) {
      return { ok: false, toast: BREAK_TOAST }
    }
    return { ok: false }
  }

  return { ok: true, node: createOperatorNode(type, position, nodes, { parentId }) }
}

export function planAddAtViewportCenter(
  type: string,
  nodes: FlowNode[],
  viewport: { x: number; y: number; zoom: number },
  size: { width: number; height: number }
): PlanAddResult {
  if (!hasOperator(type)) return { ok: false }
  if (!canAddOperator(type, nodes)) {
    const def = getOperator(type)
    if (def.constraints?.onlyInsideContainer) {
      return { ok: false, toast: BREAK_TOAST }
    }
    return { ok: false }
  }
  const center = flowCenterFromViewport(viewport, size.width, size.height)
  const offset = getNodeCenterOffset(type)
  const nodeSize = estimateNodeSize(type)
  const preferred = { x: center.x - offset.x, y: center.y - offset.y }
  const position = findNonOverlappingPosition(preferred, nodes, nodeSize)
  return { ok: true, node: createOperatorNode(type, position, nodes) }
}
