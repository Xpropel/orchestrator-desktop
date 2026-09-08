import { fieldVisible } from '../../form/field-visible'
import type { FlowEdge, FlowNode } from '../../types'
import type { OperatorDefinition } from '../../schema'
import {
  collectFormReferences,
  getAvailableVariables,
  isTypeCompatible,
  knownNodeNames,
  lookupAvailableVariable,
  parseReferences,
  resolveAcceptTypes,
  type AvailableVariable
} from '../../variables'
import type { FlowIssue } from '../issue'
import { isEmptyValue, isStartNodeName } from '../helpers'
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
  available: AvailableVariable[],
  reported: Set<string>,
  knownNames: string[]
): FlowIssue[] {
  const issues: FlowIssue[] = []
  const refs = parseReferences(value, knownNames)
  for (const ref of refs) {
    const token = `${ref.node}.${ref.variable}`
    const found = lookupAvailableVariable(available, ref.node, ref.variable)
    const isSessionField = fieldKey === 'session' || fieldKey === 'source' || accept.includes('session')
    if (!found) {
      const nodeAvailable = available.some((item) => item.nodeName === ref.node)
      const named = nodes.some((item) => item.data.name === ref.node)
      if (nodeAvailable) {
        issues.push(unknownReference(node.id, `引用的变量不存在：${token}`, fieldKey))
      } else if (named && !isStartNodeName(ref.node, nodes) && isSessionField) {
        issues.push(sessionNotUpstream(node.id, fieldKey))
      } else if (named && !isStartNodeName(ref.node, nodes)) {
        issues.push(referenceNotUpstream(node.id, token, fieldKey))
      } else if (ref.node !== 'sys' && !isStartNodeName(ref.node, nodes)) {
        issues.push(unknownReference(node.id, `引用的节点不存在：${ref.node}`, fieldKey))
      } else {
        issues.push(unknownReference(node.id, `引用的变量不存在：${token}`, fieldKey))
      }
      reported.add(token)
      continue
    }
    if (accept.length > 0 && !isTypeCompatible(found.variable.type, accept)) {
      if (accept.includes('session') && found.variable.type !== 'session') {
        issues.push(sessionTypeMismatch(node.id, fieldKey))
      } else {
        issues.push(typeMismatch(node.id, fieldKey, found.variable.type, accept))
      }
      reported.add(token)
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
  const knownNames = knownNodeNames(nodes)
  const availableNames = new Set(available.map((item) => `${item.nodeName}.${item.variable.name}`))
  const reported = new Set<string>()
  const visibleForm: Record<string, unknown> = {}

  for (const field of operator.params) {
    if (field.showWhen && !fieldVisible(node.data.form, field)) {
      continue
    }
    if (Object.prototype.hasOwnProperty.call(node.data.form, field.key)) {
      visibleForm[field.key] = node.data.form[field.key]
    }
    const value = node.data.form[field.key]
    const dedicatedWhileCondition = operator.type === 'while' && field.key === 'condition'
    if (field.required && isEmptyValue(value) && !dedicatedWhileCondition) {
      issues.push(missingRequired(node.id, field.key, field.label))
    }

    if (field.type === 'variable' && typeof value === 'string' && value.trim().length > 0) {
      const accept = resolveAcceptTypes(field.extra)
      issues.push(...referenceIssues(node, nodes, field.key, value, accept, available, reported, knownNames))
    }
  }

  issues.push(...ruleAgentNoModel(node, operator))

  const refs = collectFormReferences(visibleForm, knownNames)
  for (const ref of refs) {
    const token = `${ref.node}.${ref.variable}`
    if (availableNames.has(token) || reported.has(token)) continue
    const named = nodes.find((item) => item.data.name === ref.node)
    if (named && !isStartNodeName(ref.node, nodes)) {
      issues.push(referenceNotUpstream(node.id, token))
    } else if (ref.node !== 'sys' && !isStartNodeName(ref.node, nodes)) {
      issues.push(unknownReference(node.id, `引用的节点不存在：${token}`))
    } else {
      issues.push(unknownReference(node.id, `引用的变量不存在：${token}`))
    }
    reported.add(token)
  }

  issues.push(...ruleForkUnused(node, operator, nodes))
  return issues
}
