import { reachableFrom } from '../graph/traversal'
import { getExtensionRules, type ExtensionRule, type ExtensionRuleContext } from '../library'
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

function uniqueIssues(issues: FlowIssue[]): FlowIssue[] {
  const seen = new Set<string>()
  const out: FlowIssue[] = []
  for (const item of issues) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

/** Run extension rules; a throw or non-array return must not abort the pass. */
export function applyExtensionRules(rules: ExtensionRule[], context: ExtensionRuleContext): FlowIssue[] {
  const issues: FlowIssue[] = []
  for (const rule of rules) {
    try {
      const found = rule(context)
      if (Array.isArray(found)) issues.push(...found)
    } catch {
      // broken extension rule
    }
  }
  return issues
}

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
      ...nodes.filter((node) => operatorOf(node)?.constraints?.allowRoot === true).map((node) => node.id),
      ...nodes.filter((node) => operatorOf(node)?.kind === 'loopStart').map((node) => node.id)
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
  issues.push(...applyExtensionRules(getExtensionRules(), context))
  return uniqueIssues(issues)
}
