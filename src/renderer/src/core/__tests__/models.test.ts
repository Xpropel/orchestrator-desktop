import { beforeAll, describe, expect, it } from 'vitest'
import { builtinLibrary, loadLibrary } from '../library'
import { registerLibrary } from '../registry'
import type { OperatorDefinition } from '../schema'
import {
  MODEL_PRESETS,
  MODEL_PROVIDERS,
  isModelPresetId,
  modelPresetsGrouped,
  resolveModel,
  resolveNodeModel,
  type ModelAwareNode
} from '../models'

beforeAll(() => {
  loadLibrary()
})

function node(id: string, label: string, name: string, form: Record<string, unknown> = {}): ModelAwareNode {
  return { id, data: { label, name, form } }
}

describe('MODEL_PROVIDERS / MODEL_PRESETS', () => {
  it('registers DeepSeek and 通义千问 with four presets', () => {
    expect(MODEL_PROVIDERS).toEqual([
      { key: 'deepseek', title: 'DeepSeek' },
      { key: 'qwen', title: '通义千问' }
    ])
    expect(MODEL_PRESETS.map((item) => item.id)).toEqual([
      'deepseek-chat',
      'deepseek-reasoner',
      'qwen-plus',
      'qwen-max'
    ])
    expect(MODEL_PRESETS.every((item) => item.label === item.id)).toBe(true)
    expect(isModelPresetId('deepseek-chat')).toBe(true)
    expect(isModelPresetId('gpt-4o')).toBe(false)
    expect(modelPresetsGrouped().map((group) => group.title)).toEqual(['DeepSeek', '通义千问'])
  })
})

describe('resolveModel', () => {
  it('returns null for empty or non-string values', () => {
    expect(resolveModel(null)).toBeNull()
    expect(resolveModel(undefined)).toBeNull()
    expect(resolveModel(12)).toBeNull()
    expect(resolveModel('')).toBeNull()
    expect(resolveModel('   ')).toBeNull()
  })

  it('hits presets by exact id', () => {
    expect(resolveModel('deepseek-chat')).toEqual({ provider: 'deepseek', name: 'deepseek-chat' })
    expect(resolveModel('deepseek-reasoner')).toEqual({ provider: 'deepseek', name: 'deepseek-reasoner' })
    expect(resolveModel('qwen-plus')).toEqual({ provider: 'qwen', name: 'qwen-plus' })
    expect(resolveModel('qwen-max')).toEqual({ provider: 'qwen', name: 'qwen-max' })
  })

  it('infers provider from prefix, case-insensitive', () => {
    expect(resolveModel('DeepSeek-V3')).toEqual({ provider: 'deepseek', name: 'DeepSeek-V3' })
    expect(resolveModel('QWEN2.5-72B')).toEqual({ provider: 'qwen', name: 'QWEN2.5-72B' })
    expect(resolveModel('Tongyi-Qianwen')).toEqual({ provider: 'qwen', name: 'Tongyi-Qianwen' })
  })

  it('keeps unknown names with a generic provider', () => {
    expect(resolveModel('gpt-4o')).toEqual({ provider: null, name: 'gpt-4o' })
    expect(resolveModel('  claude-3  ')).toEqual({ provider: null, name: 'claude-3' })
  })
})

describe('resolveNodeModel', () => {
  it('uses the operator form.model when present', () => {
    const session = node('s1', 'session', 'Session_1', { model: 'deepseek-chat' })
    expect(resolveNodeModel(session, [session])).toEqual({
      provider: 'deepseek',
      name: 'deepseek-chat',
      inherited: false
    })
  })

  it('inherits from a referenced session', () => {
    const session = node('s1', 'session', 'Session_1', { model: 'qwen-plus' })
    const agent = node('a1', 'agent', 'Agent_1', { session: '{{Session_1.session}}', model: '' })
    expect(resolveNodeModel(agent, [session, agent])).toEqual({
      provider: 'qwen',
      name: 'qwen-plus',
      inherited: true
    })
  })

  it('walks a session-fork chain up to eight hops', () => {
    const session = node('s1', 'session', 'Session_1', { model: 'deepseek-reasoner' })
    const forks = Array.from({ length: 8 }, (_, index) => {
      const n = index + 1
      const source = index === 0 ? '{{Session_1.session}}' : `{{Fork_${index}.session}}`
      return node(`f${n}`, 'session-fork', `Fork_${n}`, { source })
    })
    const agent = node('a1', 'agent', 'Agent_1', { session: '{{Fork_8.session}}' })
    const nodes = [session, ...forks, agent]
    expect(resolveNodeModel(agent, nodes)).toEqual({
      provider: 'deepseek',
      name: 'deepseek-reasoner',
      inherited: true
    })
  })

  it('stops walking a fork chain after eight hops', () => {
    const session = node('s1', 'session', 'Session_1', { model: 'deepseek-chat' })
    const forks = Array.from({ length: 9 }, (_, index) => {
      const n = index + 1
      const source = index === 0 ? '{{Session_1.session}}' : `{{Fork_${index}.session}}`
      return node(`f${n}`, 'session-fork', `Fork_${n}`, { source })
    })
    const agent = node('a1', 'agent', 'Agent_1', { session: '{{Fork_9.session}}' })
    expect(resolveNodeModel(agent, [session, ...forks, agent])).toBeNull()
  })

  it('uses OperatorCategory.model when the node has no form.model', () => {
    const extra: OperatorDefinition = {
      type: 'demo.echo',
      title: 'Echo',
      description: '',
      icon: 'Sparkles',
      color: '#000',
      category: 'demo',
      kind: 'task',
      params: [],
      outputs: []
    }
    registerLibrary({
      version: 1,
      categories: [
        ...builtinLibrary.categories,
        { key: 'demo', title: 'Demo', order: 200, model: { provider: 'deepseek', name: 'DeepSeek' } }
      ],
      operators: [...builtinLibrary.operators, extra]
    })
    try {
      const echo = node('d1', 'demo.echo', 'Echo_1')
      expect(resolveNodeModel(echo, [echo])).toEqual({
        provider: 'deepseek',
        name: 'DeepSeek',
        inherited: false
      })
      const explicit = node('d2', 'demo.echo', 'Echo_2', { model: 'qwen-max' })
      expect(resolveNodeModel(explicit, [explicit])).toEqual({
        provider: 'qwen',
        name: 'qwen-max',
        inherited: false
      })
    } finally {
      loadLibrary()
    }
  })

  it('shows nothing when no rule matches', () => {
    const message = node('m1', 'message', 'Message_1', { content: 'hi' })
    expect(resolveNodeModel(message, [message])).toBeNull()
  })

  it('inherits through session-fork.source and classifier.session', () => {
    const session = node('s1', 'session', 'Session_1', { model: 'deepseek-chat' })
    const fork = node('f1', 'session-fork', 'Fork_1', { source: '{{Session_1.session}}' })
    const classifier = node('c1', 'classifier', 'Classifier_1', { session: '{{Fork_1.session}}' })
    expect(resolveNodeModel(fork, [session, fork, classifier])).toEqual({
      provider: 'deepseek',
      name: 'deepseek-chat',
      inherited: true
    })
    expect(resolveNodeModel(classifier, [session, fork, classifier])).toEqual({
      provider: 'deepseek',
      name: 'deepseek-chat',
      inherited: true
    })
  })

  it('inherits through an agent→fork→agent chain', () => {
    const session = node('s1', 'session', 'Session_1', { model: 'deepseek-chat' })
    const agent1 = node('a1', 'agent', 'Agent_1', { session: '{{Session_1.session}}', model: '' })
    const fork = node('f1', 'session-fork', 'Fork_A', { source: '{{Agent_1.session}}' })
    const agent2 = node('a2', 'agent', 'Agent_2', { session: '{{Fork_A.session}}', model: '' })
    const nodes = [session, agent1, fork, agent2]
    const inherited = { provider: 'deepseek' as const, name: 'deepseek-chat', inherited: true }
    expect(resolveNodeModel(agent1, nodes)).toEqual(inherited)
    expect(resolveNodeModel(fork, nodes)).toEqual(inherited)
    expect(resolveNodeModel(agent2, nodes)).toEqual(inherited)
  })

  it('does not loop on cyclic session references', () => {
    const a = node('a1', 'agent', 'Agent_A', { session: '{{Agent_B.session}}', model: '' })
    const b = node('a2', 'agent', 'Agent_B', { session: '{{Agent_A.session}}', model: '' })
    expect(resolveNodeModel(a, [a, b])).toBeNull()
    expect(resolveNodeModel(b, [a, b])).toBeNull()
  })

  it('matches a referenced node by id when the name is missing', () => {
    const session = node('session:abc', 'session', 'OtherName', { model: 'qwen-plus' })
    const agent = node('a1', 'agent', 'Agent_1', { session: '{{session:abc.session}}' })
    expect(resolveNodeModel(agent, [session, agent])).toEqual({
      provider: 'qwen',
      name: 'qwen-plus',
      inherited: true
    })
  })
})
