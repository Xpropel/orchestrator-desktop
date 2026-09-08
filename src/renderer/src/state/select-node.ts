import { useShallow } from 'zustand/react/shallow'
import type { FlowNode } from '@/core/types'
import { useFlowStore } from './flow-store'

/** 属性面板用的节点切片：不含 position/width/height/style，拖拽缩放时引用保持稳定。 */
export type StableNodeSnapshot = Pick<FlowNode, 'id' | 'type' | 'data' | 'parentId'>

export function selectStableNode(
  nodes: FlowNode[],
  nodeId: string | null | undefined
): StableNodeSnapshot | undefined {
  if (!nodeId) return undefined
  const node = nodes.find((item) => item.id === nodeId)
  if (!node) return undefined
  return {
    id: node.id,
    type: node.type,
    data: node.data,
    parentId: node.parentId
  }
}

export function shallowStableNodeEqual(
  left: StableNodeSnapshot | undefined,
  right: StableNodeSnapshot | undefined
): boolean {
  if (left === right) return true
  if (!left || !right) return false
  return (
    left.id === right.id &&
    left.type === right.type &&
    left.data === right.data &&
    left.parentId === right.parentId
  )
}

/** 按 id 取节点，忽略 selected/measured/几何字段带来的引用抖动。 */
export function useStableNode(nodeId: string | null | undefined): FlowNode | undefined {
  return useFlowStore(
    useShallow((state) => selectStableNode(state.nodes, nodeId) as FlowNode | undefined)
  )
}
