import type { FlowEdge, FlowNode } from '../../types'
import type { FlowIssue } from '../issue'

/**
 * 容器内外可以互连：体内节点可把数据送到容器外，容器外也可以连到体内节点。
 * 保留此规则以免旧测试 / 扩展仍引用 `CROSS_CONTAINER_EDGE`，但不再报错。
 */
export function ruleCrossContainerEdge(_nodes: FlowNode[], _edges: FlowEdge[]): FlowIssue[] {
  return []
}
