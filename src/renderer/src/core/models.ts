import { getCategory, getOperator, hasOperator } from './registry'
import { parseReferences, resolveAcceptTypes } from './variables'

export type ProviderKey = 'deepseek' | 'qwen'

export interface ModelProvider {
  key: ProviderKey
  title: string
}

export interface ModelPreset {
  id: string
  provider: ProviderKey
  label: string
}

export interface ResolvedModel {
  provider: ProviderKey | null
  name: string
}

export interface ResolvedNodeModel extends ResolvedModel {
  inherited: boolean
}

export interface ModelAwareNode {
  id: string
  data: {
    name: string
    label: string
    form: Record<string, unknown>
  }
}

export const MODEL_PROVIDERS: readonly ModelProvider[] = [
  { key: 'deepseek', title: 'DeepSeek' },
  { key: 'qwen', title: '通义千问' }
]

export const MODEL_PRESETS: readonly ModelPreset[] = [
  { id: 'deepseek-chat', provider: 'deepseek', label: 'deepseek-chat' },
  { id: 'deepseek-reasoner', provider: 'deepseek', label: 'deepseek-reasoner' },
  { id: 'qwen-plus', provider: 'qwen', label: 'qwen-plus' },
  { id: 'qwen-max', provider: 'qwen', label: 'qwen-max' }
]

const PRESET_BY_ID = new Map(MODEL_PRESETS.map((item) => [item.id, item]))

const HOP_LIMIT = 8

export function getModelPreset(id: string): ModelPreset | undefined {
  return PRESET_BY_ID.get(id)
}

export function isModelPresetId(id: string): boolean {
  return PRESET_BY_ID.has(id)
}

export function modelPresetsGrouped(): { provider: ProviderKey; title: string; presets: ModelPreset[] }[] {
  return MODEL_PROVIDERS.map((provider) => ({
    provider: provider.key,
    title: provider.title,
    presets: MODEL_PRESETS.filter((item) => item.provider === provider.key)
  }))
}

export function resolveModel(model: unknown): ResolvedModel | null {
  if (typeof model !== 'string') return null
  const name = model.trim()
  if (!name) return null
  const preset = PRESET_BY_ID.get(name)
  if (preset) {
    return { provider: preset.provider, name: preset.label }
  }
  const lower = name.toLowerCase()
  if (lower.startsWith('deepseek')) {
    return { provider: 'deepseek', name }
  }
  if (lower.startsWith('qwen') || lower.startsWith('tongyi')) {
    return { provider: 'qwen', name }
  }
  return { provider: null, name }
}

export function resolveNodeModel(
  node: ModelAwareNode,
  nodes: readonly ModelAwareNode[]
): ResolvedNodeModel | null {
  const own = resolveModel(node.data.form.model)
  if (own) {
    return { ...own, inherited: false }
  }

  const seen = new Set<string>([node.id])
  const inherited = followSession(node, nodes, 0, seen)
  if (inherited) {
    return { ...inherited, inherited: true }
  }

  const declared = categoryModelOf(node)
  if (declared) {
    return { ...declared, inherited: false }
  }

  return null
}

function sessionBindingOf(node: ModelAwareNode): string | null {
  if (!hasOperator(node.data.label)) return null
  const operator = getOperator(node.data.label)
  for (const field of operator.params) {
    if (field.type !== 'variable') continue
    if (!resolveAcceptTypes(field.extra).includes('session')) continue
    const value = node.data.form[field.key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function categoryModelOf(node: ModelAwareNode): ResolvedModel | null {
  if (!hasOperator(node.data.label)) return null
  const declared = getCategory(getOperator(node.data.label).category)?.model
  if (!declared) return null
  return { provider: declared.provider, name: declared.name }
}

function followSession(
  from: ModelAwareNode,
  nodes: readonly ModelAwareNode[],
  hops: number,
  seen: Set<string>
): ResolvedModel | null {
  if (hops > HOP_LIMIT) return null
  const binding = sessionBindingOf(from)
  if (!binding) return null
  const ref = parseReferences(binding)[0]
  const target = ref ? findNodeByRef(nodes, ref.node) : undefined
  if (!target) return null
  return applyRules(target, nodes, hops, seen)
}

function applyRules(
  node: ModelAwareNode,
  nodes: readonly ModelAwareNode[],
  hops: number,
  seen: Set<string>
): ResolvedModel | null {
  if (hops > HOP_LIMIT) return null
  if (seen.has(node.id)) return null
  seen.add(node.id)

  const own = resolveModel(node.data.form.model)
  if (own) return own

  const inherited = followSession(node, nodes, hops + 1, seen)
  if (inherited) return inherited

  return categoryModelOf(node)
}

function findNodeByRef(nodes: readonly ModelAwareNode[], nameOrId: string): ModelAwareNode | undefined {
  return nodes.find((item) => item.data.name === nameOrId) ?? nodes.find((item) => item.id === nameOrId)
}
