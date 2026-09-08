import { reachableFrom } from '../graph/traversal'
import { getExtensionRules, type ExtensionRuleContext } from '../library'
import { getOperator, hasOperator } from '../registry'
import type { FlowEdge, FlowNode } from '../types'
import type { FlowIssue } from './issue'
import { operatorOf } from './helpers'
import { ruleBreakOutsideLoop } from './rules/break-outside-loop'
import { ruleBranchNoTarget } from './rules/branch-no-target'
import { ruleCrossContainerEdge } from './rules/cross-container-edge'
import { ruleCycle } from './rules/cycle'
import { ruleDeadEnd } from './rules/dead-end'
import { ruleDuplicateName } from './rules/duplicate-name'
import { ruleEmptyContainer } from './rules/empty-container'
import { ruleForeachItemsNotArray } from './rules/foreach-items-not-array'
import { ruleNoStart, startNodesOf } from './rules/no-start'
import { ruleRequiredAndRefs } from './rules/required-and-refs'
import { ruleSessionConcurrentWrite } from './rules/session-concurrent-write'
import { ruleUnknownOperator } from './rules/unknown-operator'
import { ruleUnreachable } from './rules/unreachable'
import { ruleWhileNoCondition } from './rules/while-no-condition'

export type { FlowIssue, IssueLevel } from './issue'

export function validateFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  globals: Record<string, unknown> = {}
): FlowIssue[] {
  const issues: FlowIssue[] = []
  const starts = startNodesOf(nodes)
  issues.push(...ruleNoStart(starts))

  const startIds = starts.map((node) => node.id)
  const rootIds = [
    ...new Set([
      ...startIds,
      ...nodes.filter((node) => operatorOf(node)?.constraints?.allowRoot === true).map((node) => node.id)
    ])
  ]
  const reachable = reachableFrom(nodes, edges, rootIds)

  issues.push(...ruleDuplicateName(nodes))
  issues.push(...ruleCycle(nodes, edges))
  issues.push(...ruleCrossContainerEdge(nodes, edges))

  for (const node of nodes) {
    const unknown = ruleUnknownOperator(node)
    if (unknown.length > 0) {
      issues.push(...unknown)
      continue
    }
    const operator = operatorOf(node)
    if (!operator) continue
    issues.push(
      ...ruleUnreachable(node, operator, startIds, reachable),
      ...ruleDeadEnd(node, operator, edges),
      ...ruleEmptyContainer(node, operator, nodes),
      ...ruleBreakOutsideLoop(node, operator),
      ...ruleWhileNoCondition(node, operator),
      ...ruleForeachItemsNotArray(node, operator, nodes, edges),
      ...ruleBranchNoTarget(node, operator, edges),
      ...ruleRequiredAndRefs(node, operator, nodes, edges)
    )
  }

  issues.push(...ruleSessionConcurrentWrite(nodes, edges))

  const context: ExtensionRuleContext = {
    nodes,
    edges,
    globals,
    getOperator: (type) => (hasOperator(type) ? getOperator(type) : undefined)
  }
  for (const rule of getExtensionRules()) {
    issues.push(...rule(context))
  }
  return issues
}
