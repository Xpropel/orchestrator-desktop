export type NodeClickKeys = {
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}

export type NodeClickPlan =
  | { kind: 'exclusive'; id: string; openInspector: true }
  | { kind: 'add'; id: string }
  | { kind: 'remove'; id: string }

export function isMultiSelectModifier(keys: NodeClickKeys): boolean {
  return Boolean(keys.shiftKey || keys.ctrlKey || keys.metaKey)
}

/** pointerdown 捕获阶段记下的选中 id；不要在 RF 随后的 select change 里改写。 */
export function selectedIdsOf(nodes: readonly { id: string; selected?: boolean }[]): string[] {
  return nodes.filter((item) => item.selected).map((item) => item.id)
}

/** 用 pointerdown 时的选中快照做计划，避免 React Flow 先独占选中后再点选。 */
export function planNodeClick(
  keys: NodeClickKeys,
  nodeId: string,
  selectedIds: readonly string[]
): NodeClickPlan {
  if (!isMultiSelectModifier(keys)) {
    return { kind: 'exclusive', id: nodeId, openInspector: true }
  }
  if (selectedIds.includes(nodeId)) {
    return { kind: 'remove', id: nodeId }
  }
  return { kind: 'add', id: nodeId }
}

export function nextSelectedIds(plan: NodeClickPlan, previouslySelected: readonly string[]): string[] {
  if (plan.kind === 'exclusive') return [plan.id]
  if (plan.kind === 'add') return [...previouslySelected.filter((id) => id !== plan.id), plan.id]
  return previouslySelected.filter((id) => id !== plan.id)
}

export function selectionChangesFor(
  nodes: readonly { id: string; selected?: boolean }[],
  nextIds: readonly string[]
): Array<{ id: string; type: 'select'; selected: boolean }> {
  const wanted = new Set(nextIds)
  return nodes
    .filter((node) => Boolean(node.selected) !== wanted.has(node.id))
    .map((node) => ({ id: node.id, type: 'select' as const, selected: wanted.has(node.id) }))
}
