import { parseInputs } from './form-items'
import { parentIdOf } from './graph/parent-id'
import { getUpstreamNodeIds } from './graph/traversal'
import { getOperator, hasOperator } from './registry'
import { isVarType, type VariableDef, type VarType } from './schema'
import type { FlowEdge, FlowNode } from './types'

interface VariableRef {
  raw: string
  node: string
  variable: string
}

export type VariableScope = 'upstream' | 'global' | 'container'

export interface AvailableVariable {
  nodeId: string
  nodeName: string
  variable: VariableDef
  scope: VariableScope
}

const REF_RE = /\{\{\s*([^{}]+?)\s*\}\}/g

const SYS_VARIABLES: VariableDef[] = [
  { name: 'query', type: 'string', description: '当前用户输入' },
  { name: 'files', type: 'array', description: '当前会话附件' },
  { name: 'now', type: 'string', description: '当前时间' }
]

export function parseReferences(text: string): VariableRef[] {
  const refs: VariableRef[] = []
  const seen = new Set<string>()
  REF_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = REF_RE.exec(text)) !== null) {
    const inner = match[1]?.trim() ?? ''
    const dot = inner.indexOf('.')
    if (dot <= 0 || dot === inner.length - 1) continue
    const node = inner.slice(0, dot).trim()
    const variable = inner.slice(dot + 1).trim()
    if (!node || !variable) continue
    const raw = match[0]
    const key = `${raw}\0${node}\0${variable}`
    if (seen.has(key)) continue
    seen.add(key)
    refs.push({ raw, node, variable })
  }
  return refs
}

export { getUpstreamNodeIds }

function nodeById(nodes: FlowNode[]): Map<string, FlowNode> {
  return new Map(nodes.map((node) => [node.id, node]))
}

function startNodesOf(nodes: FlowNode[]): FlowNode[] {
  return nodes.filter((node) => {
    if (!hasOperator(node.data.label)) return false
    return getOperator(node.data.label).kind === 'start'
  })
}

export function getNodeOutputs(node: FlowNode): VariableDef[] {
  if (!hasOperator(node.data.label)) return []
  const operator = getOperator(node.data.label)
  const fromParam = operator.constraints?.outputsFromParam
  if (!fromParam) return operator.outputs
  const derived = parseInputs(node.data.form[fromParam])
    .filter((item) => item.key)
    .map((item) => ({
      name: item.key,
      type: item.type,
      description: item.description
    }))
  const derivedNames = new Set(derived.map((item) => item.name))
  return [...operator.outputs.filter((item) => !derivedNames.has(item.name)), ...derived]
}

function collectContainerChain(nodeId: string, nodes: FlowNode[]): FlowNode[] {
  const map = nodeById(nodes)
  const chain: FlowNode[] = []
  let current = map.get(nodeId)
  const seen = new Set<string>()
  while (current) {
    const parent = parentIdOf(current)
    if (!parent || seen.has(parent)) break
    seen.add(parent)
    const container = map.get(parent)
    if (!container) break
    chain.push(container)
    current = container
  }
  return chain
}

function pushUnique(bag: AvailableVariable[], seen: Set<string>, item: AvailableVariable): void {
  const key = `${item.scope}:${item.nodeName}.${item.variable.name}`
  if (seen.has(key)) return
  seen.add(key)
  bag.push(item)
}

export function getAvailableVariables(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[]
): AvailableVariable[] {
  const map = nodeById(nodes)
  const target = map.get(nodeId)
  const result: AvailableVariable[] = []
  const seen = new Set<string>()

  for (const variable of SYS_VARIABLES) {
    pushUnique(result, seen, {
      nodeId: 'sys',
      nodeName: 'sys',
      variable,
      scope: 'global'
    })
  }

  for (const start of startNodesOf(nodes)) {
    for (const variable of getNodeOutputs(start)) {
      if (!variable.name) continue
      pushUnique(result, seen, {
        nodeId: start.id,
        nodeName: start.data.name,
        variable,
        scope: 'global'
      })
    }
  }

  const upstreamIds = getUpstreamNodeIds(nodeId, nodes, edges)
  for (const id of upstreamIds) {
    const node = map.get(id)
    if (!node) continue
    if (hasOperator(node.data.label) && getOperator(node.data.label).kind === 'note') continue
    for (const variable of getNodeOutputs(node)) {
      if (!variable.name) continue
      pushUnique(result, seen, {
        nodeId: node.id,
        nodeName: node.data.name,
        variable,
        scope: 'upstream'
      })
    }
  }

  if (!target) return result

  const containers = collectContainerChain(nodeId, nodes)
  for (const container of containers) {
    if (!hasOperator(container.data.label)) continue
    const operator = getOperator(container.data.label)
    for (const variable of operator.scopeVariables ?? []) {
      pushUnique(result, seen, {
        nodeId: container.id,
        nodeName: container.data.name,
        variable,
        scope: 'container'
      })
    }
    const containerUpstream = getUpstreamNodeIds(container.id, nodes, edges)
    for (const id of containerUpstream) {
      const node = map.get(id)
      if (!node) continue
      if (hasOperator(node.data.label) && getOperator(node.data.label).kind === 'note') continue
      for (const variable of getNodeOutputs(node)) {
        if (!variable.name) continue
        pushUnique(result, seen, {
          nodeId: node.id,
          nodeName: node.data.name,
          variable,
          scope: 'upstream'
        })
      }
    }
  }

  return result
}

export function isTypeCompatible(actual: VarType, accept: VarType[]): boolean {
  if (accept.length === 0) return true
  if (actual === 'any' || accept.includes('any')) return true
  return accept.includes(actual)
}

function renameInText(text: string, oldName: string, newName: string): string {
  if (oldName === newName || oldName.length === 0) return text
  const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(oldName)}\\.`, 'g')
  return text.replace(pattern, `{{${newName}.`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function renameReferencesInForm(
  form: Record<string, unknown>,
  oldName: string,
  newName: string
): Record<string, unknown> {
  return walkRename(form, oldName, newName) as Record<string, unknown>
}

function walkRename(value: unknown, oldName: string, newName: string): unknown {
  if (typeof value === 'string') {
    return renameInText(value, oldName, newName)
  }
  if (Array.isArray(value)) {
    return value.map((item) => walkRename(item, oldName, newName))
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      next[key] = walkRename(entry, oldName, newName)
    }
    return next
  }
  return value
}

export function renameReferencesInGraph(nodes: FlowNode[], oldName: string, newName: string): FlowNode[] {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      form: renameReferencesInForm(node.data.form, oldName, newName)
    }
  }))
}

export function collectFormReferences(form: unknown): VariableRef[] {
  const refs: VariableRef[] = []
  const seen = new Set<string>()
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const ref of parseReferences(value)) {
        const key = `${ref.node}.${ref.variable}`
        if (seen.has(key)) continue
        seen.add(key)
        refs.push(ref)
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(visit)
    }
  }
  visit(form)
  return refs
}

export function resolveAcceptTypes(extra: Record<string, unknown> | undefined): VarType[] {
  const raw = extra?.accept
  if (!Array.isArray(raw)) return []
  return raw.filter(isVarType)
}
