import { beforeAll, describe, expect, it } from 'vitest'
import { loadLibrary } from '@/core/library'
import type { FlowEdge, FlowNode } from '@/core/types'
import {
  getAvailableVariables,
  getNodeOutputs,
  getUpstreamNodeIds,
  isTypeCompatible,
  parseReferences,
  renameReferencesInForm,
  renameReferencesInGraph
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

describe('parseReferences', () => {
  it('parses node.variable and global refs', () => {
    const refs = parseReferences('hi {{Agent_1.text}} and {{sys.query}} {{start.q}} {{bad}} {{.x}}')
    expect(refs).toEqual([
      { raw: '{{Agent_1.text}}', node: 'Agent_1', variable: 'text' },
      { raw: '{{sys.query}}', node: 'sys', variable: 'query' },
      { raw: '{{start.q}}', node: 'start', variable: 'q' }
    ])
  })
})

describe('getUpstreamNodeIds / getAvailableVariables', () => {
  it('walks incoming edges and exposes outputs + globals + container scope', () => {
    const nodes = [
      node('s', 'start', 'Start_1', { inputs: [{ key: 'q', type: 'string', required: true, description: '' }] }),
      node('a', 'agent', 'Agent_1', { prompt: 'x', model: 'm' }),
      node('loop', 'foreach', 'For_1', { items: '{{Agent_1.json}}' }),
      node('inner', 'code', 'Code_1', { code: '1' }, { parentId: 'loop' })
    ]
    const edges = [edge('s', 'a'), edge('a', 'loop')]

    expect(getUpstreamNodeIds('a', nodes, edges).sort()).toEqual(['s'])
    expect(getUpstreamNodeIds('inner', nodes, edges)).toEqual([])

    const vars = getAvailableVariables('inner', nodes, edges)
    expect(vars.some((item) => item.nodeName === 'sys' && item.variable.name === 'query')).toBe(true)
    expect(vars.some((item) => item.nodeName === 'Start_1' && item.variable.name === 'q')).toBe(true)
    expect(vars.some((item) => item.scope === 'container' && item.variable.name === 'item')).toBe(true)
    expect(vars.some((item) => item.scope === 'container' && item.variable.name === 'index')).toBe(true)
    expect(vars.some((item) => item.nodeName === 'Agent_1' && item.variable.name === 'text')).toBe(true)
    expect(vars.some((item) => item.nodeName === 'For_1' && item.variable.name === 'results')).toBe(false)
  })

  it('does not expose container results to the interior', () => {
    const nodes = [
      node('s', 'start', 'Start_1'),
      node('loop', 'foreach', 'For_1', { items: '{{sys.files}}' }),
      node('inner', 'message', 'Msg_1', { content: 'x' }, { parentId: 'loop' }),
      node('after', 'message', 'After_1', { content: '{{For_1.results}}' })
    ]
    const edges = [edge('s', 'loop'), edge('loop', 'after')]
    const inside = getAvailableVariables('inner', nodes, edges)
    const outside = getAvailableVariables('after', nodes, edges)
    expect(inside.some((item) => item.variable.name === 'results')).toBe(false)
    expect(outside.some((item) => item.nodeName === 'For_1' && item.variable.name === 'results')).toBe(true)
  })

  it('exposes every start node inputs as globals under that node name', () => {
    const nodes = [
      node('start', 'start', 'start', { inputs: [{ key: 'q', type: 'string', required: true, description: '' }] }),
      node('s2', 'start', 'start_1', { inputs: [{ key: 'x', type: 'number', required: false, description: '' }] }),
      node('m', 'message', 'Msg_1', { content: '{{start_1.x}}' })
    ]
    const vars = getAvailableVariables('m', nodes, [])
    expect(vars.some((item) => item.nodeName === 'start' && item.variable.name === 'q' && item.scope === 'global')).toBe(
      true
    )
    expect(vars.some((item) => item.nodeName === 'start_1' && item.variable.name === 'x' && item.scope === 'global')).toBe(
      true
    )
  })
})

describe('isTypeCompatible', () => {
  it('treats any as wildcard', () => {
    expect(isTypeCompatible('string', ['session'])).toBe(false)
    expect(isTypeCompatible('session', ['session'])).toBe(true)
    expect(isTypeCompatible('string', ['any'])).toBe(true)
    expect(isTypeCompatible('any', ['number'])).toBe(true)
    expect(isTypeCompatible('number', [])).toBe(true)
  })
})

describe('renameReferencesInForm / Graph', () => {
  it('rewrites {{Old.var}} across nested form values', () => {
    const form = {
      prompt: 'see {{Old.text}}',
      nested: { a: '{{Old.session}}' },
      list: ['{{Keep.x}}', '{{Old.json}}']
    }
    expect(renameReferencesInForm(form, 'Old', 'New')).toEqual({
      prompt: 'see {{New.text}}',
      nested: { a: '{{New.session}}' },
      list: ['{{Keep.x}}', '{{New.json}}']
    })

    const nodes = [node('a', 'agent', 'A', { prompt: '{{Old.text}}' })]
    const next = renameReferencesInGraph(nodes, 'Old', 'New')
    expect(next[0]?.data.form.prompt).toBe('{{New.text}}')
    expect(nodes[0]?.data.form.prompt).toBe('{{Old.text}}')
  })
})

describe('getNodeOutputs', () => {
  it('derives start outputs from the inputs param', () => {
    const start = node('s', 'start', 'start', {
      inputs: [{ key: 'q', type: 'string', required: true, description: '问' }]
    })
    expect(getNodeOutputs(start)).toEqual([{ name: 'q', type: 'string', description: '问' }])
  })

  it('merges dataset static outputs with fields from outputsFromParam', () => {
    const dataset = node('ds', 'dataset', 'Dataset_1', {
      fields: [
        { key: 'user_id', type: 'string', required: true, description: '用户' },
        { key: 'score', type: 'number', required: false, description: '' }
      ]
    })
    const outputs = getNodeOutputs(dataset)
    expect(outputs.map((item) => item.name)).toEqual(['data', 'count', 'schema', 'user_id', 'score'])
    expect(outputs.find((item) => item.name === 'data')?.type).toBe('array')
    expect(outputs.find((item) => item.name === 'count')?.type).toBe('number')
    expect(outputs.find((item) => item.name === 'schema')?.type).toBe('object')
    expect(outputs.find((item) => item.name === 'user_id')).toEqual({
      name: 'user_id',
      type: 'string',
      description: '用户'
    })
    expect(outputs.find((item) => item.name === 'score')?.type).toBe('number')
  })

  it('lets a derived field override a static output of the same name', () => {
    const dataset = node('ds', 'dataset', 'Dataset_1', {
      fields: [{ key: 'data', type: 'string', required: false, description: '覆盖' }]
    })
    const outputs = getNodeOutputs(dataset)
    expect(outputs.map((item) => item.name)).toEqual(['count', 'schema', 'data'])
    expect(outputs.filter((item) => item.name === 'data')).toHaveLength(1)
    expect(outputs.find((item) => item.name === 'data')).toEqual({
      name: 'data',
      type: 'string',
      description: '覆盖'
    })
  })
})
