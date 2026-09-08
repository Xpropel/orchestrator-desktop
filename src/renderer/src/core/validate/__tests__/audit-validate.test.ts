import { beforeAll, describe, expect, it } from 'vitest'
import { loadLibrary } from '@/core/library'
import type { ExtensionRule } from '@/core/library'
import { issue } from '../issue'
import type { FlowEdge, FlowNode } from '@/core/types'
import { applyExtensionRules, validateFlow } from '../index'

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

function issues(nodes: FlowNode[], edges: FlowEdge[], code?: string) {
  const all = validateFlow(nodes, edges)
  return code ? all.filter((item) => item.code === code) : all
}

const start = (): FlowNode =>
  node('s', 'start', 'Start_1', { inputs: [{ key: 'q', type: 'string', required: false, description: '' }] })

describe('audit validate: containers and reachability', () => {
  it('treats loop-start as the container root for UNREACHABLE', () => {
    const loop = node('loop', 'foreach', 'Loop_1', { items: '{{sys.files}}' }, { type: 'containerNode' })
    const loopStart = node('loop:start', 'loop-start', 'LoopStart_1', {}, { type: 'loopStartNode', parentId: 'loop' })
    const connected = node('a', 'agent', 'Agent_1', { prompt: 'p', model: 'm' }, { type: 'taskNode', parentId: 'loop' })
    const isolated = node('b', 'message', 'Msg_1', { content: 'x' }, { type: 'taskNode', parentId: 'loop' })
    const end = node('e', 'end', 'End_1')
    const nodes = [start(), loop, loopStart, connected, isolated, end]
    const edges = [edge('s', 'loop'), edge('loop:start', 'a'), edge('loop', 'e')]
    const unreachable = issues(nodes, edges, 'UNREACHABLE')
    expect(unreachable.map((item) => item.nodeId)).toEqual(['b'])
    expect(issues(nodes, edges, 'DEAD_END')).toHaveLength(0)
  })

  it('does not treat break or end inside a loop as dead ends', () => {
    const loop = node('loop', 'while', 'While_1', { condition: 'true' }, { type: 'containerNode' })
    const loopStart = node('loop:start', 'loop-start', 'LoopStart_1', {}, { parentId: 'loop' })
    const inner = node('m', 'message', 'Msg_1', { content: 'x' }, { parentId: 'loop' })
    const br = node('b', 'break', 'Break_1', {}, { parentId: 'loop' })
    const innerEnd = node('ie', 'end', 'End_inner', {}, { parentId: 'loop' })
    const nodes = [start(), loop, loopStart, inner, br, innerEnd]
    const edges = [edge('s', 'loop'), edge('loop:start', 'm'), edge('m', 'b'), edge('loop:start', 'ie')]
    expect(issues(nodes, edges, 'DEAD_END')).toHaveLength(0)
    expect(issues(nodes, edges, 'BREAK_OUTSIDE_LOOP')).toHaveLength(0)
  })

  it('allows container ↔ child edges and flags true cross-container edges', () => {
    const loop = node('loop', 'foreach', 'Loop_1', { items: '{{sys.files}}' })
    const loopStart = node('loop:start', 'loop-start', 'LoopStart_1', {}, { parentId: 'loop' })
    const inner = node('m', 'message', 'Msg_1', { content: 'x' }, { parentId: 'loop' })
    const outside = node('e', 'end', 'End_1')
    expect(
      issues(
        [start(), loop, loopStart, inner, outside],
        [edge('s', 'loop'), edge('loop', 'm'), edge('loop', 'e')],
        'CROSS_CONTAINER_EDGE'
      )
    ).toHaveLength(0)
    expect(
      issues(
        [start(), loop, loopStart, inner, outside],
        [edge('s', 'loop'), edge('m', 'e')],
        'CROSS_CONTAINER_EDGE'
      )
    ).toHaveLength(1)
  })

  it('does not treat a loop body cycle as a top-level CYCLE', () => {
    const loop = node('loop', 'foreach', 'Loop_1', { items: '{{sys.files}}' })
    const loopStart = node('loop:start', 'loop-start', 'LoopStart_1', {}, { parentId: 'loop' })
    const a = node('a', 'agent', 'Agent_1', { prompt: 'p', model: 'm' }, { parentId: 'loop' })
    const b = node('b', 'agent', 'Agent_2', { prompt: 'p', model: 'm' }, { parentId: 'loop' })
    expect(
      issues(
        [start(), loop, loopStart, a, b],
        [edge('s', 'loop'), edge('loop:start', 'a'), edge('a', 'b'), edge('b', 'a')],
        'CYCLE'
      )
    ).toHaveLength(0)
  })
})

describe('audit validate: references and required', () => {
  it('resolves dotted historical node names in {{foo.bar.out}}', () => {
    const dotted = node('fb', 'start', 'foo.bar', {
      inputs: [{ key: 'out', type: 'string', required: false, description: '' }]
    })
    const ok = node('m', 'message', 'Msg_1', { content: '{{foo.bar.out}}' })
    const bad = node('m2', 'message', 'Msg_2', { content: '{{foo.baz}}' })
    expect(issues([dotted, ok], [edge('fb', 'm')], 'UNKNOWN_REFERENCE')).toHaveLength(0)
    expect(issues([dotted, ok], [edge('fb', 'm')], 'REFERENCE_NOT_UPSTREAM')).toHaveLength(0)
    expect(issues([dotted, bad], [edge('fb', 'm2')], 'UNKNOWN_REFERENCE')).toHaveLength(1)
  })

  it('accepts {{Loop_1.item}} and {{sys.query}} inside a loop', () => {
    const loop = node('loop', 'foreach', 'Loop_1', { items: '{{sys.files}}' })
    const loopStart = node('loop:start', 'loop-start', 'LoopStart_1', {}, { parentId: 'loop' })
    const inner = node(
      'm',
      'message',
      'Msg_1',
      { content: '{{Loop_1.item}} {{Loop_1.index}} {{sys.query}}' },
      { parentId: 'loop' }
    )
    const nodes = [start(), loop, loopStart, inner]
    const edges = [edge('s', 'loop'), edge('loop:start', 'm')]
    expect(issues(nodes, edges, 'UNKNOWN_REFERENCE')).toHaveLength(0)
    expect(issues(nodes, edges, 'REFERENCE_NOT_UPSTREAM')).toHaveLength(0)
  })

  it('does not flag showWhen-hidden required fields', () => {
    const dataset = node('d', 'dataset', 'Dataset_1', { source: 'inline', data_type: 'table' })
    const nodes = [start(), dataset]
    expect(issues(nodes, [edge('s', 'd')], 'MISSING_REQUIRED')).toHaveLength(0)
  })

  it('requires dataset path/url/upstream only when that source is visible', () => {
    const file = node('d', 'dataset', 'Dataset_1', { source: 'file', data_type: 'table' })
    expect(issues([start(), file], [edge('s', 'd')], 'MISSING_REQUIRED').some((item) => item.field === 'path')).toBe(
      true
    )
    const ok = node('d2', 'dataset', 'Dataset_2', { source: 'file', data_type: 'table', path: 'a.csv' })
    expect(issues([start(), ok], [edge('s', 'd2')], 'MISSING_REQUIRED')).toHaveLength(0)
  })

  it('ignores references left in hidden showWhen fields', () => {
    const dataset = node('d', 'dataset', 'Dataset_1', {
      source: 'inline',
      data_type: 'table',
      url: '{{Ghost.missing}}'
    })
    expect(issues([start(), dataset], [edge('s', 'd')], 'UNKNOWN_REFERENCE')).toHaveLength(0)
  })

  it('emits a single session issue instead of also REFERENCE_NOT_UPSTREAM', () => {
    const sess = node('sess', 'session', 'Session_1', { model: 'm' })
    const agent = node('a', 'agent', 'Agent_1', { prompt: 'p', session: '{{Session_1.session}}' })
    const found = issues([start(), sess, agent], [edge('s', 'sess'), edge('s', 'a')])
    expect(found.filter((item) => item.code === 'SESSION_NOT_UPSTREAM')).toHaveLength(1)
    expect(found.filter((item) => item.code === 'REFERENCE_NOT_UPSTREAM')).toHaveLength(0)
  })

  it('emits WHILE_NO_CONDITION without a duplicate MISSING_REQUIRED', () => {
    const w = node('w', 'while', 'While_1', { condition: '' })
    const child = node('n', 'message', 'Msg_1', { content: 'x' }, { parentId: 'w' })
    const found = issues([start(), w, child], [edge('s', 'w')])
    expect(found.filter((item) => item.code === 'WHILE_NO_CONDITION')).toHaveLength(1)
    expect(found.filter((item) => item.code === 'MISSING_REQUIRED' && item.field === 'condition')).toHaveLength(0)
  })

  it('gives each unknown reference on one node a distinct issue id', () => {
    const msg = node('m', 'message', 'Msg_1', { content: '{{Ghost.a}} {{Phantom.b}}' })
    const found = issues([start(), msg], [edge('s', 'm')], 'UNKNOWN_REFERENCE')
    expect(found).toHaveLength(2)
    expect(new Set(found.map((item) => item.id)).size).toBe(2)
    expect(found.every((item) => item.nodeId === 'm')).toBe(true)
  })

  it('requires list map/filter expressions and text joinWith only when selected', () => {
    const mapEmpty = node('l', 'list-operation', 'List_1', { items: '{{sys.files}}', operation: 'map' })
    const mapOk = node('l2', 'list-operation', 'List_2', {
      items: '{{sys.files}}',
      operation: 'map',
      expression: 'item'
    })
    const unique = node('l3', 'list-operation', 'List_3', { items: '{{sys.files}}', operation: 'unique' })
    const filterEmpty = node('l4', 'list-operation', 'List_4', { items: '{{sys.files}}', operation: 'filter' })
    expect(
      issues([start(), mapEmpty], [edge('s', 'l')], 'MISSING_REQUIRED').some((item) => item.field === 'expression')
    ).toBe(true)
    expect(issues([start(), mapOk], [edge('s', 'l2')], 'MISSING_REQUIRED')).toHaveLength(0)
    expect(issues([start(), unique], [edge('s', 'l3')], 'MISSING_REQUIRED')).toHaveLength(0)
    expect(
      issues([start(), filterEmpty], [edge('s', 'l4')], 'MISSING_REQUIRED').some(
        (item) => item.field === 'filterExpression'
      )
    ).toBe(true)

    const joinEmpty = node('t', 'text-operation', 'Text_1', { text: 'a', operation: 'join', joinWith: '' })
    const joinOk = node('t2', 'text-operation', 'Text_2', { text: 'a', operation: 'join', joinWith: ',' })
    const trim = node('t3', 'text-operation', 'Text_3', { text: 'a', operation: 'trim' })
    expect(
      issues([start(), joinEmpty], [edge('s', 't')], 'MISSING_REQUIRED').some((item) => item.field === 'joinWith')
    ).toBe(true)
    expect(issues([start(), joinOk], [edge('s', 't2')], 'MISSING_REQUIRED')).toHaveLength(0)
    expect(issues([start(), trim], [edge('s', 't3')], 'MISSING_REQUIRED')).toHaveLength(0)
  })

  it('treats DUPLICATE_NAME as case-sensitive and trims whitespace', () => {
    expect(
      issues(
        [start(), node('a', 'end', 'Same'), node('b', 'end', 'same')],
        [edge('s', 'a'), edge('s', 'b')],
        'DUPLICATE_NAME'
      )
    ).toHaveLength(0)
    expect(
      issues(
        [start(), node('a', 'end', 'Same'), node('b', 'end', 'Same ')],
        [edge('s', 'a'), edge('s', 'b')],
        'DUPLICATE_NAME'
      )
    ).toHaveLength(2)
  })
})

describe('audit validate: branches and extensions', () => {
  it('warns when the else outlet has no target', () => {
    const sw = node('sw', 'switch', 'Switch_1', { cases: [{ id: 'c1', label: 'A', expression: '1' }] })
    const end = node('e', 'end', 'End_1')
    const found = issues([start(), sw, end], [edge('s', 'sw'), edge('sw', 'e', 'c1')], 'BRANCH_NO_TARGET')
    expect(found.some((item) => item.field === 'else')).toBe(true)
    expect(
      issues(
        [start(), sw, end],
        [edge('s', 'sw'), edge('sw', 'e', 'c1'), edge('sw', 'e', 'else#1')],
        'BRANCH_NO_TARGET'
      )
    ).toHaveLength(0)
  })

  it('keeps validating after an extension rule throws', () => {
    const context = {
      nodes: [start()],
      edges: [] as FlowEdge[],
      globals: {},
      getOperator: () => undefined
    }
    const rules: ExtensionRule[] = [
      () => {
        throw new Error('boom')
      },
      () => [issue('error', 'EXT_OK', 'survived', { nodeId: 's' })],
      () => undefined as unknown as ReturnType<ExtensionRule>
    ]
    const found = applyExtensionRules(rules, context)
    expect(found.map((item) => item.code)).toEqual(['EXT_OK'])
  })

  it('does not emit DS2API_SESSION_REQUIRED alongside MISSING_REQUIRED', () => {
    const chat = node('c', 'ds2api.chat.completion', 'Chat_1', { prompt: 'hi' })
    const found = issues([start(), chat], [edge('s', 'c')])
    expect(found.filter((item) => item.code === 'DS2API_SESSION_REQUIRED')).toHaveLength(0)
    expect(found.filter((item) => item.code === 'MISSING_REQUIRED' && item.field === 'session_id')).toHaveLength(1)
  })

  it('still reports AGENT_NO_MODEL when prompt is present', () => {
    expect(issues([start(), node('a', 'agent', 'Agent_1', { prompt: 'hi' })], [edge('s', 'a')], 'AGENT_NO_MODEL')).toHaveLength(
      1
    )
  })
})
