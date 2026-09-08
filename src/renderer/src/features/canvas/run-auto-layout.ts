import { computeAutoLayout } from '@/core/graph'
import { useFlowStore } from '@/state/flow-store'

export function runAutoLayout(): void {
  const { nodes, edges, applyNodePositions } = useFlowStore.getState()
  const { positions, sizes } = computeAutoLayout(nodes, edges)
  applyNodePositions(positions, sizes)
}
