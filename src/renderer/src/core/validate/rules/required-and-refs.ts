import { fieldVisible } from '../../form/field-visible'
import type { FlowEdge, FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import {
  collectFormReferences,
  getAvailableVariables,
  isTypeCompatible,
  parseReferences,
  resolveAcceptTypes,
  type AvailableVariable
} from '../../variables'
import type { FlowIssue } from '../issue'
import { isEmptyValue, isStartNodeName, lookupAvailable } from '../helpers'
import { ruleAgentNoModel } from './agent-no-model'
import { ruleForkUnused } from './fork-unused'
import { missingRequired } from './missing-required'
import { referenceNotUpstream } from './reference-not-upstream'
import { sessionNotUpstream } from './session-not-upstream'
import { sessionTypeMismatch } from './session-type-mismatch'
import { typeMismatch } from './type-mismatch'
import { unknownReference } from './unknown-reference'

function referenceIssues(
  node: FlowNode,
  nodes: FlowNode[],
  fieldKey: string,
  value: string,
  accept: ReturnType<typeof resolveAcceptTypes>,
  available: AvailableVariable[]
): FlowIssue[] {
  const issues: FlowIssue[] = []
  const refs = parseReferences(value)
  for (const ref of refs) {
    const found = lookupAvailable(available, ref.node, ref.variable)
    const isSessionField = fieldKey === 'session' || fieldKey === 'source' || accept.includes('session')
    if (!found) {
      const nodeAvailable = available.some((item) => item.nodeName === ref.node)
      const named = nodes.some((item) => item.data.name === ref.node)
      if (nodeAvailable) {
        issues.push(unknownReference(node.id, `引用的变量不存在：${ref.node}.${ref.variable}`, fieldKey))
      } else if (named && !isStartNodeName(ref.node, nodes) && isSessionField) {
        issues.push(sessionNotUpstream(node.id, fieldKey))
      } else if (named && !isStartNodeName(ref.node, nodes)) {
        issues.push(referenceNotUpstream(node.id, `${ref.node}.${ref.variable}`, fieldKey))
      } else if (ref.node !== 'sys' && !isStartNodeName(ref.node, nodes)) {
        issues.push(unknownReference(node.id, `引用的节点不存在：${ref.node}`, fieldKey))
      } else {
        issues.push(unknownReference(node.id, `引用的变量不存在：${ref.node}.${ref.variable}`, fieldKey))
      }
      continue
    }
    if (accept.length > 0 && !isTypeCompatible(found.variable.type, accept)) {
      if (accept.includes('session') && found.variable.type !== 'session') {
        issues.push(sessionTypeMismatch(node.id, fieldKey))
      } else {
        issues.push(typeMismatch(node.id, fieldKey, found.variable.type, accept))
      }
    }
  }
  return issues
}

export function ruleRequiredAndRefs(
  node: FlowNode,
  operator: OperatorDefinition,
  nodes: FlowNode[],
  edges: FlowEdge[]
): FlowIssue[] {
  const issues: FlowIssue[] = []
  const available = getAvailableVariables(node.id, nodes, edges)
  const availableNames = new Set(available.map((item) => `${item.nodeName}.${item.variable.name}`))

  for (const field of operator.params) {
    if (field.showWhen && !fieldVisible(node.data.form, field)) {
      continue
    }
    const value = node.data.form[field.key]
    if (field.required && isEmptyValue(value)) {
      issues.push(missingRequired(node.id, field.key, field.label))
    }

    if (field.type === 'variable' && typeof value === 'string' && value.trim().length > 0) {
      const accept = resolveAcceptTypes(field.extra)
      issues.push(...referenceIssues(node, nodes, field.key, value, accept, available))
    }
  }

  issues.push(...ruleAgentNoModel(node, operator))

  const refs = collectFormReferences(node.data.form)
  for (const ref of refs) {
    if (availableNames.has(`${ref.node}.${ref.variable}`)) continue
    const token = `${ref.node}.${ref.variable}`
    const already = issues.some((item) => item.nodeId === node.id && item.message.includes(token))
    if (already) continue
    const named = nodes.find((item) => item.data.name === ref.node)
    if (named && !isStartNodeName(ref.node, nodes)) {
      issues.push(referenceNotUpstream(node.id, token))
    } else if (ref.node !== 'sys' && !isStartNodeName(ref.node, nodes)) {
      issues.push(unknownReference(node.id, `引用的节点不存在：${token}`))
    } else {
      issues.push(unknownReference(node.id, `引用的变量不存在：${token}`))
    }
  }

  issues.push(...ruleForkUnused(node, operator, nodes))
  return issues
}
