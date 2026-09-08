export function parentIdOf(node: { parentId?: string | null }): string | undefined {
  return typeof node.parentId === 'string' && node.parentId.length > 0 ? node.parentId : undefined
}
