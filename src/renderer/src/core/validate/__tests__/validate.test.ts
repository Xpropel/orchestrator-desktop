import { beforeAll, describe, expect, it } from 'vitest'
import { builtinLibrary, loadLibrary } from '@/core/library'
import { registerLibrary } from '@/core/registry'
import type { OperatorDefinition } from '@/core/schema'
import type { FlowEdge, FlowNode } from '@/core/types'
import { validateFlow } from '../index'

beforeAll(() => {
  loadLibrary()
})

function node(
  id: string,
  label: string,
  name: string,
  form: Record<string, unknown> = {},
  extras: Partial<FlowNode> = {}
): FlowNode {
  return {
    id,
    type: extras.type,
    position: extras.position ?? { x: 0, y: 0 },
    parentId: extras.parentId,
    data: { label, name, form }
  }
}

function edge(source: string, target: string, sourceHandle = 'start'): FlowEdge {
  return { id: `${source}-${sourceHandle}-${target}`, source, target, sourceHandle }
}

function codes(nodes: FlowNode[], edges: FlowEdge[], code: string): number {
  return validateFlow(nodes, edges).filter((item) => item.code === code).length
}

const start = (): FlowNode =>
  node('s', 'start', 'Start_1', { inputs: [{ key: 'q', type: 'string', required: false, description: '' }] })

describe('validateFlow section 5', () => {
  it('NO_START allows multiple starts', () => {
    expect(codes([], [], 'NO_START')).toBe(1)
    expect(codes([start()], [], 'NO_START')).toBe(0)
    expect(codes([start(), node('s2', 'start', 'Start_2')], [], 'NO_START')).toBe(0)
    expect(codes([start(), node('s2', 'start', 'Start_2')], [], 'MULTI_START')).toBe(0)
  })

  it('UNREACHABLE', () => {
    const isolated = node('a', 'agent', 'Agent_1', { prompt: 'p', model: 'm' })
    expect(codes([start(), isolated], [], 'UNREACHABLE')).toBe(1)
    expect(codes([start(), isolated], [edge('s', 'a')], 'UNREACHABLE')).toBe(0)
  })

  it('UNREACHABLE walks from any start; allowRoot nodes need no upstream', () => {
    const a = node('a', 'agent', 'Agent_1', { prompt: 'p', model: 'm' })
    const s2 = node('s2', 'start', 'start_1')
    expect(codes([start(), s2, a], [edge('s2', 'a')], 'UNREACHABLE')).toBe(0)
    const dataset = node('d', 'dataset', 'Dataset_1', {
      fields: [{ key: 'x', type: 'string', required: false, description: '' }]
    })
    expect(codes([start(), dataset], [], 'UNREACHABLE')).toBe(0)
  })

  it('DEAD_END warns when a start has no outgoing edge', () => {
    expect(codes([start()], [], 'DEAD_END')).toBe(1)
    const end = node('e', 'end', 'End_1')
    expect(codes([start(), end], [edge('s', 'e')], 'DEAD_END')).toBe(0)
  })

  it('accepts {{start_1.x}} as a global start reference', () => {
    const s2 = node('s2', 'start', 'start_1', {
      inputs: [{ key: 'x', type: 'string', required: false, description: '' }]
    })
    const msg = node('m', 'message', 'Msg_1', { content: '{{start_1.x}}' })
    expect(codes([start(), s2, msg], [edge('s2', 'm')], 'UNKNOWN_REFERENCE')).toBe(0)
    expect(codes([start(), s2, msg], [edge('s2', 'm')], 'REFERENCE_NOT_UPSTREAM')).toBe(0)
    const missing = node('m2', 'message', 'Msg_2', { content: '{{start_1.missing}}' })
    expect(codes([start(), s2, missing], [edge('s2', 'm2')], 'UNKNOWN_REFERENCE')).toBe(1)
  })

  it('DEAD_END', () => {
    const agent = node('a', 'agent', 'Agent_1', { prompt: 'p', model: 'm' })
    const end = node('e', 'end', 'End_1')
    expect(codes([start(), agent], [edge('s', 'a')], 'DEAD_END')).toBe(1)
    expect(codes([start(), agent, end], [edge('s', 'a'), edge('a', 'e')], 'DEAD_END')).toBe(0)
  })

  it('DEAD_END ignores the last node inside a container body (iteration ends there)', () => {
    const loop = node('loop', 'foreach', 'Loop_1', { items: '{{start.q}}' }, { type: 'containerNode' })
    const loopStart = node('loop:start', 'loop-start', 'LoopStart_1', {}, { type: 'loopStartNode', parentId: 'loop' })
    const inner = node('a', 'agent', 'Agent_1', { prompt: 'p', model: 'm' }, { type: 'taskNode', parentId: 'loop' })
    const end = node('e', 'end', 'End_1')
    const nodes = [start(), loop, loopStart, inner, end]
    const edges = [edge('s', 'loop'), edge('loop:start', 'a'), edge('loop', 'e')]
    expect(codes(nodes, edges, 'DEAD_END')).toBe(0)
  })

  it('MISSING_REQUIRED', () => {
    const http = node('h', 'http', 'Http_1', { method: 'GET' })
    expect(codes([start(), http], [edge('s', 'h')], 'MISSING_REQUIRED')).toBeGreaterThan(0)
    expect(codes([start(), node('h', 'http', 'Http_1', { method: 'GET', url: 'https://x' })], [edge('s', 'h')], 'MISSING_REQUIRED')).toBe(0)
  })

  it('UNKNOWN_REFERENCE', () => {
    const msg = node('m', 'message', 'Msg_1', { content: '{{Ghost.text}}' })
    expect(codes([start(), msg], [edge('s', 'm')], 'UNKNOWN_REFERENCE')).toBe(1)
    expect(codes([start(), node('m', 'message', 'Msg_1', { content: '{{sys.query}}' })], [edge('s', 'm')], 'UNKNOWN_REFERENCE')).toBe(0)
  })

  it('REFERENCE_NOT_UPSTREAM', () => {
    const a = node('a', 'agent', 'Agent_1', { prompt: 'p', model: 'm' })
    const b = node('b', 'message', 'Msg_1', { content: '{{Agent_1.text}}' })
    expect(codes([start(), a, b], [edge('s', 'a'), edge('s', 'b')], 'REFERENCE_NOT_UPSTREAM')).toBe(1)
    expect(codes([start(), a, b], [edge('s', 'a'), edge('a', 'b')], 'REFERENCE_NOT_UPSTREAM')).toBe(0)
  })

  it('TYPE_MISMATCH', () => {
    const extra: OperatorDefinition = {
      type: 'test.needs-array',
      title: 'Needs Array',
      description: '',
      icon: 'List',
      color: '#000',
      category: 'data',
      kind: 'task',
      params: [{ key: 'items', label: 'items', type: 'variable', extra: { accept: ['array'] } }],
      outputs: []
    }
    registerLibrary({
      version: 1,
      categories: builtinLibrary.categories,
      operators: [...builtinLibrary.operators, extra]
    })
    try {
      const tpl = node('t', 'prompt-template', 'Tpl_1', { template: 'x' })
      const files = node('f', 'test.needs-array', 'Files_1', { items: '{{Tpl_1.text}}' })
      expect(codes([start(), tpl, files], [edge('s', 't'), edge('t', 'f')], 'TYPE_MISMATCH')).toBe(1)
      const list = node('l', 'list-operation', 'List_1', { items: '{{sys.files}}', operation: 'unique' })
      expect(codes([start(), list], [edge('s', 'l')], 'TYPE_MISMATCH')).toBe(0)
    } finally {
      loadLibrary()
    }
  })

  it('DUPLICATE_NAME', () => {
    const a = node('a', 'end', 'Same')
    const b = node('b', 'end', 'Same')
    expect(codes([start(), a, b], [edge('s', 'a'), edge('s', 'b')], 'DUPLICATE_NAME')).toBe(2)
    expect(codes([start(), node('a', 'end', 'A'), node('b', 'end', 'B')], [edge('s', 'a')], 'DUPLICATE_NAME')).toBe(0)
  })

  it('EMPTY_CONTAINER', () => {
    const empty = node('c', 'foreach', 'For_1', { items: '{{sys.files}}' })
    expect(codes([start(), empty], [edge('s', 'c')], 'EMPTY_CONTAINER')).toBe(1)
    const filled = node('c2', 'foreach', 'For_2', { items: '{{sys.files}}' })
    const child = node('n', 'message', 'Msg_1', { content: 'x' }, { parentId: 'c2' })
    expect(codes([start(), filled, child], [edge('s', 'c2')], 'EMPTY_CONTAINER')).toBe(0)
  })

  it('BREAK_OUTSIDE_LOOP', () => {
    expect(codes([start(), node('b', 'break', 'Break_1')], [edge('s', 'b')], 'BREAK_OUTSIDE_LOOP')).toBe(1)
    const loop = node('c', 'foreach', 'For_1', { items: '{{sys.files}}' })
    const br = node('b', 'break', 'Break_1', {}, { parentId: 'c' })
    expect(codes([start(), loop, br], [edge('s', 'c')], 'BREAK_OUTSIDE_LOOP')).toBe(0)
  })

  it('WHILE_NO_CONDITION', () => {
    const w = node('w', 'while', 'While_1', { condition: '' })
    const child = node('n', 'message', 'Msg_1', { content: 'x' }, { parentId: 'w' })
    expect(codes([start(), w, child], [edge('s', 'w')], 'WHILE_NO_CONDITION')).toBe(1)
    expect(
      codes(
        [start(), node('w2', 'while', 'While_2', { condition: 'true' }), node('n2', 'message', 'Msg_2', { content: 'x' }, { parentId: 'w2' })],
        [edge('s', 'w2')],
        'WHILE_NO_CONDITION'
      )
    ).toBe(0)
  })

  it('FOREACH_ITEMS_NOT_ARRAY', () => {
    const tpl = node('t', 'prompt-template', 'Tpl_1', { template: 'x' })
    const bad = node('f', 'foreach', 'For_1', { items: '{{Tpl_1.text}}' })
    const child = node('n', 'message', 'Msg_1', { content: 'x' }, { parentId: 'f' })
    expect(codes([start(), tpl, bad, child], [edge('s', 't'), edge('t', 'f')], 'FOREACH_ITEMS_NOT_ARRAY')).toBe(1)
    const ok = node('f2', 'foreach', 'For_2', { items: '{{sys.files}}' })
    const child2 = node('n2', 'message', 'Msg_2', { content: 'x' }, { parentId: 'f2' })
    expect(codes([start(), ok, child2], [edge('s', 'f2')], 'FOREACH_ITEMS_NOT_ARRAY')).toBe(0)
  })

  it('BRANCH_NO_TARGET', () => {
    const sw = node('sw', 'switch', 'Switch_1', {
      cases: [{ id: 'c1', label: 'A', expression: '1' }]
    })
    expect(codes([start(), sw], [edge('s', 'sw')], 'BRANCH_NO_TARGET')).toBeGreaterThan(0)
    const end = node('e', 'end', 'End_1')
    expect(
      codes(
        [start(), sw, end],
        [edge('s', 'sw'), edge('sw', 'e', 'c1'), edge('sw', 'e', 'else')],
        'BRANCH_NO_TARGET'
      )
    ).toBe(0)
  })

  it('CROSS_CONTAINER_EDGE', () => {
    const loop = node('c', 'foreach', 'For_1', { items: '{{sys.files}}' })
    const inner = node('n', 'message', 'Msg_1', { content: 'x' }, { parentId: 'c' })
    const outside = node('o', 'end', 'End_1')
    expect(codes([start(), loop, inner, outside], [edge('s', 'c'), edge('n', 'o')], 'CROSS_CONTAINER_EDGE')).toBe(1)
    expect(codes([start(), loop, inner, outside], [edge('s', 'c'), edge('c', 'o')], 'CROSS_CONTAINER_EDGE')).toBe(0)
  })

  it('CYCLE', () => {
    const a = node('a', 'agent', 'Agent_1', { prompt: 'p', model: 'm' })
    const b = node('b', 'agent', 'Agent_2', { prompt: 'p', model: 'm' })
    expect(codes([start(), a, b], [edge('s', 'a'), edge('a', 'b'), edge('b', 'a')], 'CYCLE')).toBe(1)
    expect(codes([start(), a, b], [edge('s', 'a'), edge('a', 'b')], 'CYCLE')).toBe(0)
  })
})

describe('validateFlow section 2.1', () => {
  it('SESSION_TYPE_MISMATCH', () => {
    const tpl = node('t', 'prompt-template', 'Tpl_1', { template: 'x' })
    const agent = node('a', 'agent', 'Agent_1', { prompt: 'p', session: '{{Tpl_1.text}}' })
    expect(codes([start(), tpl, agent], [edge('s', 't'), edge('t', 'a')], 'SESSION_TYPE_MISMATCH')).toBe(1)
    const sess = node('sess', 'session', 'Session_1', { model: 'm' })
    const ok = node('a2', 'agent', 'Agent_2', { prompt: 'p', session: '{{Session_1.session}}' })
    expect(codes([start(), sess, ok], [edge('s', 'sess'), edge('sess', 'a2')], 'SESSION_TYPE_MISMATCH')).toBe(0)
  })

  it('SESSION_NOT_UPSTREAM', () => {
    const sess = node('sess', 'session', 'Session_1', { model: 'm' })
    const agent = node('a', 'agent', 'Agent_1', { prompt: 'p', session: '{{Session_1.session}}' })
    expect(codes([start(), sess, agent], [edge('s', 'sess'), edge('s', 'a')], 'SESSION_NOT_UPSTREAM')).toBe(1)
    expect(codes([start(), sess, agent], [edge('s', 'sess'), edge('sess', 'a')], 'SESSION_NOT_UPSTREAM')).toBe(0)
  })

  it('AGENT_NO_MODEL', () => {
    expect(codes([start(), node('a', 'agent', 'Agent_1', { prompt: 'p' })], [edge('s', 'a')], 'AGENT_NO_MODEL')).toBe(1)
    expect(
      codes([start(), node('a', 'agent', 'Agent_1', { prompt: 'p', model: 'gpt' })], [edge('s', 'a')], 'AGENT_NO_MODEL')
    ).toBe(0)
  })

  it('FORK_UNUSED', () => {
    const sess = node('sess', 'session', 'Session_1', { model: 'm' })
    const fork = node('f', 'session-fork', 'Fork_1', { source: '{{Session_1.session}}' })
    expect(codes([start(), sess, fork], [edge('s', 'sess'), edge('sess', 'f')], 'FORK_UNUSED')).toBe(1)
    const agent = node('a', 'agent', 'Agent_1', { prompt: 'p', session: '{{Fork_1.session}}' })
    expect(codes([start(), sess, fork, agent], [edge('s', 'sess'), edge('sess', 'f'), edge('f', 'a')], 'FORK_UNUSED')).toBe(0)
  })

  it('SESSION_CONCURRENT_WRITE', () => {
    const sess = node('sess', 'session', 'Session_1', { model: 'm' })
    const sw = node('sw', 'switch', 'Switch_1', { cases: [{ id: 'c1', label: 'A', expression: '1' }] })
    const a1 = node('a1', 'agent', 'Agent_1', { prompt: 'p', session: '{{Session_1.session}}' })
    const a2 = node('a2', 'agent', 'Agent_2', { prompt: 'p', session: '{{Session_1.session}}' })
    const parallel = [
      start(),
      sess,
      sw,
      a1,
      a2
    ]
    const parallelEdges = [
      edge('s', 'sess'),
      edge('sess', 'sw'),
      edge('sw', 'a1', 'c1'),
      edge('sw', 'a2', 'else')
    ]
    expect(codes(parallel, parallelEdges, 'SESSION_CONCURRENT_WRITE')).toBeGreaterThan(0)
    expect(
      codes(
        [start(), sess, a1, a2],
        [edge('s', 'sess'), edge('sess', 'a1'), edge('a1', 'a2')],
        'SESSION_CONCURRENT_WRITE'
      )
    ).toBe(0)
  })

})
