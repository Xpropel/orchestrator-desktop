import { beforeAll, describe, expect, it } from 'vitest'
import { parseAssignments, parseCases, parseCategories, parseInputs, parseKeyValueItems } from '@/core/form-items'
import { loadLibrary } from '@/core/library'
import type { FlowEdge, FlowNode } from '@/core/types'
import { getSourceHandles } from '../registry'
import {
  getAvailableVariables,
  getNodeOutputs,
  invalidNodeNameReason,
  lookupAvailableVariable,
  parseReferences,
  renameReferencesInGraph,
  splitReferenceBody
} from '../variables'

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
  return { id: `${source}->${target}`, source, target, sourceHandle }
}

describe('parseCases / parseCategories ids stay stable', () => {
  it('assigns the same fallback id across repeated parses when id is missing', () => {
    const raw = [{ label: 'Yes', expression: 'x > 0' }, { label: 'No', expression: 'x <= 0' }]
    const first = parseCases(raw)
    const second = parseCases(raw)
    expect(first.map((item) => item.id)).toEqual(['case-0', 'case-1'])
    expect(second.map((item) => item.id)).toEqual(['case-0', 'case-1'])
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id))
  })

  it('keeps switch source handles stable when case ids are missing', () => {
    const form = { cases: [{ label: 'A', expression: '1' }] }
    const first = getSourceHandles('switch', form).map((handle) => handle.id)
    const second = getSourceHandles('switch', form).map((handle) => handle.id)
    expect(first).toEqual(['case-0', 'else'])
    expect(second).toEqual(first)
  })

  it('keeps an existing case id so branch handles do not move', () => {
    const raw = [{ id: 'keep-me', label: 'A', expression: '' }]
    expect(parseCases(raw)[0]?.id).toBe('keep-me')
  })

  it('assigns stable category and assignment fallback ids', () => {
    const first = parseCategories([{ name: 'Spam' }])
    const second = parseCategories([{ name: 'Spam' }])
    expect(first.map((item) => item.id)).toEqual(['category-0'])
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id))
    expect(parseAssignments([{ variable: '{{A.x}}', value: '1' }])[0]?.id).toBe('assign-0')
    expect(parseKeyValueItems([{ key: 'h', value: 'v' }])[0]?.id).toBe('kv-0')
    expect(parseInputs([{ key: 'q', type: 'string', required: true, description: '' }])[0]?.id).toBe('input-0')
  })
})

describe('parseReferences', () => {
  it('trims spaces, keeps unicode names, and takes the path after the first dot', () => {
    expect(parseReferences('see {{  节点_1.输出 }} and {{ start . x }}')).toEqual([
      { raw: '{{  节点_1.输出 }}', node: '节点_1', variable: '输出' },
      { raw: '{{ start . x }}', node: 'start', variable: 'x' }
    ])
    expect(parseReferences('{{Agent.a.b}}')).toEqual([
      { raw: '{{Agent.a.b}}', node: 'Agent', variable: 'a.b' }
    ])
  })

  it('uses the longest known node name when a list is provided', () => {
    expect(parseReferences('{{foo.bar.out}}')).toEqual([
      { raw: '{{foo.bar.out}}', node: 'foo', variable: 'bar.out' }
    ])
    expect(parseReferences('{{foo.bar.out}}', ['foo', 'foo.bar'])).toEqual([
      { raw: '{{foo.bar.out}}', node: 'foo.bar', variable: 'out' }
    ])
    expect(splitReferenceBody('foo.bar.out', ['foo', 'foo.bar'])).toEqual({ node: 'foo.bar', variable: 'out' })
    expect(splitReferenceBody('start . x', ['start'])).toEqual({ node: 'start', variable: 'x' })
  })
})

describe('invalidNodeNameReason', () => {
  it('rejects empty, padded, dotted, and brace names', () => {
    expect(invalidNodeNameReason('')).toBe('名称不能为空')
    expect(invalidNodeNameReason('   ')).toBe('名称不能为空')
    expect(invalidNodeNameReason(' foo')).toBe('名称两端不能有空格')
    expect(invalidNodeNameReason('foo ')).toBe('名称两端不能有空格')
    expect(invalidNodeNameReason('foo.bar')).toBe('名称不能包含 . { }')
    expect(invalidNodeNameReason('foo{x}')).toBe('名称不能包含 . { }')
    expect(invalidNodeNameReason('Agent_1')).toBeUndefined()
  })
})

describe('renameReferencesInGraph description + dotted names', () => {
  it('rewrites {{Old.var}} inside data.description as well as form', () => {
    const source = node('a', 'agent', 'A', { prompt: '{{Old.text}}' })
    source.data.description = 'see {{Old.text}}'
    const next = renameReferencesInGraph([source], 'Old', 'New')
    expect(next[0]?.data.form.prompt).toBe('{{New.text}}')
    expect(next[0]?.data.description).toBe('see {{New.text}}')
    expect(source.data.description).toBe('see {{Old.text}}')
  })

  it('does not rewrite a longer dotted node when renaming a prefix name', () => {
    const nodes = [
      node('a', 'agent', 'foo', { prompt: '{{foo.x}}' }),
      node('b', 'agent', 'foo.bar', { prompt: '{{foo.bar.out}}' })
    ]
    const next = renameReferencesInGraph(nodes, 'foo', 'baz')
    expect(next[0]?.data.form.prompt).toBe('{{baz.x}}')
    expect(next[1]?.data.form.prompt).toBe('{{foo.bar.out}}')
  })
})

describe('lookupAvailableVariable', () => {
  it('resolves {{foo.bar.out}} against a start named foo.bar', () => {
    const nodes = [
      node('s', 'start', 'foo.bar', { inputs: [{ key: 'out', type: 'string', required: false, description: '' }] }),
      node('m', 'message', 'Msg_1', { content: '{{foo.bar.out}}' })
    ]
    const vars = getAvailableVariables('m', nodes, [])
    const found = lookupAvailableVariable(vars, 'foo.bar.out')
    expect(found?.nodeName).toBe('foo.bar')
    expect(found?.variable.name).toBe('out')
  })
})

describe('getNodeOutputs duplicates and empty keys', () => {
  it('drops empty keys and keeps the last derived field when names collide', () => {
    const start = node('s', 'start', 'start', {
      inputs: [
        { key: '', type: 'string', required: false, description: 'skip' },
        { key: 'q', type: 'string', required: true, description: 'first' },
        { key: 'q', type: 'number', required: false, description: 'last' }
      ]
    })
    expect(getNodeOutputs(start)).toEqual([{ name: 'q', type: 'number', description: 'last' }])
  })
})

describe('getAvailableVariables', () => {
  it('does not list a start output twice as global and upstream', () => {
    const nodes = [
      node('s', 'start', 'Start_1', { inputs: [{ key: 'q', type: 'string', required: true, description: '' }] }),
      node('m', 'message', 'Msg_1', { content: '{{Start_1.q}}' })
    ]
    const edges = [edge('s', 'm')]
    const vars = getAvailableVariables('m', nodes, edges)
    const startQ = vars.filter((item) => item.nodeName === 'Start_1' && item.variable.name === 'q')
    expect(startQ).toHaveLength(1)
    expect(startQ[0]?.scope).toBe('global')
  })

  it('does not expose container-internal nodes to a node outside the container', () => {
    const nodes = [
      node('s', 'start', 'Start_1'),
      node('loop', 'foreach', 'For_1', { items: '{{sys.files}}' }),
      node('inner', 'code', 'Code_1', { code: '1' }, { parentId: 'loop' }),
      node('after', 'message', 'After_1', { content: 'x' })
    ]
    const edges = [edge('s', 'loop'), edge('loop', 'after')]
    const outside = getAvailableVariables('after', nodes, edges)
    expect(outside.some((item) => item.nodeName === 'Code_1')).toBe(false)
    expect(outside.some((item) => item.scope === 'container')).toBe(false)
  })
})
