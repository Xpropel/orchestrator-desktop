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

/** Official DeepSeek web `model_type` for a new session (2026-09-11 live settings). */
export const DEFAULT_DEEPSEEK_MODEL = 'default'

/** Official completion default: `thinking_enabled = true`. */
export const DEFAULT_THINKING_ENABLED = true

const LEGACY_MODEL_IDS: Record<string, string> = {
  'deepseek-chat': DEFAULT_DEEPSEEK_MODEL,
  'deepseek-reasoner': DEFAULT_DEEPSEEK_MODEL
}

const FORM_MODEL_KEYS = ['model', 'model_type', 'to_model_type'] as const

export const MODEL_PROVIDERS: readonly ModelProvider[] = [
  { key: 'deepseek', title: 'DeepSeek' },
  { key: 'qwen', title: '通义千问' }
]

export const MODEL_PRESETS: readonly ModelPreset[] = [
  { id: 'default', provider: 'deepseek', label: '快速模式' },
  { id: 'expert', provider: 'deepseek', label: '专家模式' },
  { id: 'vision', provider: 'deepseek', label: '识图模式' },
  { id: 'qwen-plus', provider: 'qwen', label: 'qwen-plus' },
  { id: 'qwen-max', provider: 'qwen', label: 'qwen-max' }
]

const PRESET_BY_ID = new Map(MODEL_PRESETS.map((item) => [item.id, item]))

const HOP_LIMIT = 8

/** Map obsolete OpenAI-style DeepSeek ids onto official `model_type` values. */
export function migrateModelId(id: string): string {
  const trimmed = id.trim()
  return LEGACY_MODEL_IDS[trimmed] ?? trimmed
}

export function migrateFormModels(form: Record<string, unknown>): Record<string, unknown> {
  let changed = false
  const next = { ...form }
  for (const key of FORM_MODEL_KEYS) {
    const value = next[key]
    if (typeof value !== 'string' || value.trim().length === 0) continue
    const migrated = migrateModelId(value)
    if (migrated !== value) {
      next[key] = migrated
      changed = true
    }
  }
  return changed ? next : form
}

export function getModelPreset(id: string): ModelPreset | undefined {
  return PRESET_BY_ID.get(migrateModelId(id))
}

export function isModelPresetId(id: string): boolean {
  return PRESET_BY_ID.has(migrateModelId(id))
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
  const preset = getModelPreset(name)
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
  const own = ownResolvedModel(node)
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

function ownResolvedModel(node: ModelAwareNode): ResolvedModel | null {
  return resolveModel(node.data.form.model) ?? resolveModel(node.data.form.model_type)
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
  const ref = parseReferences(
    binding,
    nodes.map((item) => item.data.name)
  )[0]
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

  const own = ownResolvedModel(node)
  if (own) return own

  const inherited = followSession(node, nodes, hops + 1, seen)
  if (inherited) return inherited

  return categoryModelOf(node)
}

function findNodeByRef(nodes: readonly ModelAwareNode[], nameOrId: string): ModelAwareNode | undefined {
  return nodes.find((item) => item.data.name === nameOrId) ?? nodes.find((item) => item.id === nameOrId)
}
