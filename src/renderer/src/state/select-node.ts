import { useShallow } from 'zustand/react/shallow'
import type { FlowNode } from '@/core/types'
import { useFlowStore } from './flow-store'

/** 按 id 取节点，忽略 selected/measured 等运行时字段带来的引用抖动。 */
export function useStableNode(nodeId: string | null | undefined): FlowNode | undefined {
  return useFlowStore(
    useShallow((state) => {
      if (!nodeId) return undefined
      const node = state.nodes.find((item) => item.id === nodeId)
      if (!node) return undefined
      return {
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        parentId: node.parentId,
        width: node.width,
        height: node.height,
        style: node.style
      }
    })
  )
}
