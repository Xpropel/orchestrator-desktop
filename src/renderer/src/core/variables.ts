import { parseInputs } from './form-items'
import { parentIdOf } from './graph/parent-id'
import { getUpstreamNodeIds } from './graph/traversal'
import { getOperator, hasOperator } from './registry'
import { isVarType, type VariableDef, type VarType } from './schema'
import type { FlowEdge, FlowNode } from './types'

export interface VariableRef {
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

/** 名称含 `.` `{` `}`，或首尾/全是空白时，不能作为 `{{name.var}}` 的节点名。 */
export function invalidNodeNameReason(name: string): string | undefined {
  if (name.trim().length === 0) return '名称不能为空'
  if (name !== name.trim()) return '名称两端不能有空格'
  if (name.includes('.') || name.includes('{') || name.includes('}')) return '名称不能包含 . { }'
  return undefined
}

export function knownNodeNames(nodes: Iterable<{ data: { name: string } }>, extra: Iterable<string> = []): string[] {
  const names = new Set<string>(['sys', ...extra])
  for (const node of nodes) {
    if (node.data.name) names.add(node.data.name)
  }
  return [...names]
}

/** 有已知节点名时取最长前缀；否则按第一个 `.` 切开（无节点列表的纯解析）。 */
export function splitReferenceBody(
  inner: string,
  knownNames?: Iterable<string>
): { node: string; variable: string } | null {
  const body = inner.trim()
  if (!body) return null
  if (knownNames) {
    let best: { node: string; variable: string } | null = null
    for (const name of knownNames) {
      if (!name || !body.startsWith(name)) continue
      const rest = body.slice(name.length).match(/^\s*\.\s*(.+)$/)
      const variable = rest?.[1]?.trim() ?? ''
      if (!variable) continue
      if (!best || name.length > best.node.length) {
        best = { node: name, variable }
      }
    }
    if (best) return best
  }
  const dot = body.indexOf('.')
  if (dot <= 0 || dot === body.length - 1) return null
  const node = body.slice(0, dot).trim()
  const variable = body.slice(dot + 1).trim()
  if (!node || !variable) return null
  return { node, variable }
}

export function parseReferences(text: string, knownNames?: Iterable<string>): VariableRef[] {
  const refs: VariableRef[] = []
  const seen = new Set<string>()
  const names = knownNames ? knownNodeNames([], knownNames) : undefined
  REF_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = REF_RE.exec(text)) !== null) {
    const inner = match[1]?.trim() ?? ''
    const split = splitReferenceBody(inner, names)
    if (!split) continue
    const raw = match[0]
    const key = `${raw}\0${split.node}\0${split.variable}`
    if (seen.has(key)) continue
    seen.add(key)
    refs.push({ raw, node: split.node, variable: split.variable })
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

/** 节点向下游暴露的输出变量：算子静态 `outputs`，再并入 `outputsFromParam` 参数里声明的字段（同名以声明为准）。 */
export function getNodeOutputs(node: Pick<FlowNode, 'data'>): VariableDef[] {
  if (!hasOperator(node.data.label)) return []
  const operator = getOperator(node.data.label)
  const fromParam = operator.constraints?.outputsFromParam
  if (!fromParam) return operator.outputs
  const derivedByName = new Map<string, VariableDef>()
  for (const item of parseInputs(node.data.form[fromParam])) {
    if (!item.key) continue
    derivedByName.set(item.key, {
      name: item.key,
      type: item.type,
      description: item.description
    })
  }
  const derived = [...derivedByName.values()]
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
  const key = `${item.nodeId}\0${item.variable.name}`
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

/** 用可用变量表里的节点名做最长前缀匹配（兼容历史文档里带 `.` 的节点名）。 */
export function lookupAvailableVariable<T extends { nodeName: string; variable: { name: string } }>(
  available: readonly T[],
  nodeOrBody: string,
  variable?: string
): T | undefined {
  const names = available.map((item) => item.nodeName)
  const body = variable === undefined ? nodeOrBody : `${nodeOrBody}.${variable}`
  const split = splitReferenceBody(body, names)
  if (!split) return undefined
  return available.find((item) => item.nodeName === split.node && item.variable.name === split.variable)
}

export function isTypeCompatible(actual: VarType, accept: VarType[]): boolean {
  if (accept.length === 0) return true
  if (actual === 'any' || accept.includes('any')) return true
  return accept.includes(actual)
}

function renameInText(text: string, oldName: string, newName: string, knownNames?: Iterable<string>): string {
  if (oldName === newName || oldName.length === 0) return text
  const names = knownNames ? knownNodeNames([], [...knownNames, oldName]) : [oldName, 'sys']
  return text.replace(REF_RE, (raw, inner: string) => {
    const split = splitReferenceBody(inner ?? '', names)
    if (!split || split.node !== oldName) return raw
    return `{{${newName}.${split.variable}}}`
  })
}

export function renameReferencesInForm(
  form: Record<string, unknown>,
  oldName: string,
  newName: string,
  knownNames?: Iterable<string>
): Record<string, unknown> {
  return walkRename(form, oldName, newName, knownNames) as Record<string, unknown>
}

function walkRename(value: unknown, oldName: string, newName: string, knownNames?: Iterable<string>): unknown {
  if (typeof value === 'string') {
    return renameInText(value, oldName, newName, knownNames)
  }
  if (Array.isArray(value)) {
    return value.map((item) => walkRename(item, oldName, newName, knownNames))
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      next[key] = walkRename(entry, oldName, newName, knownNames)
    }
    return next
  }
  return value
}

export function renameReferencesInGraph(nodes: FlowNode[], oldName: string, newName: string): FlowNode[] {
  const known = knownNodeNames(nodes, [oldName, newName])
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      description:
        typeof node.data.description === 'string'
          ? renameInText(node.data.description, oldName, newName, known)
          : node.data.description,
      form: renameReferencesInForm(node.data.form, oldName, newName, known)
    }
  }))
}

export function collectFormReferences(form: unknown, knownNames?: Iterable<string>): VariableRef[] {
  const refs: VariableRef[] = []
  const seen = new Set<string>()
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const ref of parseReferences(value, knownNames)) {
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
