import { useCallback } from 'react'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'
import { planAddAtFlowPosition, planAddAtViewportCenter, type PlanAddOptions } from './plan-add-node'
import type { FlowNode } from '@/core/types'

export function useAddNode(): {
  addAtFlowPosition: (
    type: string,
    center: { x: number; y: number },
    options?: PlanAddOptions
  ) => FlowNode | null
  addAtViewportCenter: (type: string) => FlowNode | null
} {
  const addNode = useFlowStore((state) => state.addNode)

  const commit = useCallback(
    (planned: ReturnType<typeof planAddAtFlowPosition>): FlowNode | null => {
      if (!planned.ok) {
        if (planned.toast) useUiStore.getState().showToast(planned.toast)
        return null
      }
      addNode(planned.node)
      // 新节点直接进入编辑：选中并打开属性面板。
      useFlowStore.getState().selectNode(planned.node.id)
      useUiStore.getState().openInspector(planned.node.id)
      return planned.node
    },
    [addNode]
  )

  const addAtFlowPosition = useCallback(
    (type: string, center: { x: number; y: number }, options?: PlanAddOptions): FlowNode | null => {
      return commit(planAddAtFlowPosition(type, center, useFlowStore.getState().nodes, options))
    },
    [commit]
  )

  const addAtViewportCenter = useCallback(
    (type: string): FlowNode | null => {
      const { viewport, nodes } = useFlowStore.getState()
      const el = document.querySelector('.react-flow')
      const width = el instanceof HTMLElement ? el.clientWidth : 800
      const height = el instanceof HTMLElement ? el.clientHeight : 600
      return commit(planAddAtViewportCenter(type, nodes, viewport, { width, height }))
    },
    [commit]
  )

  return { addAtFlowPosition, addAtViewportCenter }
}
