import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { documentToGraph, graphToDocument, parseDocument, serializeDocument } from '../dsl'
import { loadLibrary } from '../library'
import type { FlowDocument, FlowEdge, FlowNode } from '../types'

beforeAll(() => {
  loadLibrary()
})

const fixtureDir = dirname(fileURLToPath(import.meta.url))

function makeNode(
  id: string,
  label: FlowNode['data']['label'],
  form: Record<string, unknown>,
  extras: Partial<FlowNode> = {}
): FlowNode {
  return {
    id,
    type: extras.type,
    position: extras.position ?? { x: 0, y: 0 },
    parentId: extras.parentId,
    data: {
      label,
      name: extras.data?.name ?? label,
      form
    },
    selected: true,
    dragging: false,
    measured: { width: 180, height: 64 }
  }
}

function makeEdge(id: string, source: string, target: string, sourceHandle?: string): FlowEdge {
  return { id, source, target, sourceHandle, selected: true }
}

describe('graphToDocument', () => {
  it('computes upstream/downstream and writes parent_id', () => {
    const nodes = [
      makeNode('begin', 'start', {}),
      makeNode('agent:a', 'agent', { prompt: 'hi' }),
      makeNode('agent:b', 'agent', { prompt: 'bye' }),
      makeNode('msg', 'message', { content: 'ok' }),
      makeNode('loop', 'foreach', { items: '{{sys.files}}' }),
      makeNode('inner', 'code', { code: '1' }, { parentId: 'loop' })
    ]
    const edges = [
      makeEdge('e1', 'begin', 'agent:a'),
      makeEdge('e2', 'begin', 'agent:b'),
      makeEdge('e3', 'agent:a', 'msg'),
      makeEdge('e4', 'agent:b', 'msg'),
      makeEdge('e5', 'agent:a', 'msg'),
      makeEdge('e6', 'begin', 'loop')
    ]

    const doc = graphToDocument(nodes, edges, 'Demo', { custom: { token: 'a', path: 'b' } })
    expect(doc.components['begin']?.downstream).toEqual(['agent:a', 'agent:b', 'loop'])
    expect(doc.components['msg']?.upstream).toEqual(['agent:a', 'agent:b'])
    expect(doc.components['inner']?.parent_id).toBe('loop')
    expect(doc.components['loop']?.parent_id).toBeUndefined()
    expect(doc.globals).toEqual({ custom: { token: 'a', path: 'b' } })
  })

  it('excludes note nodes from components', () => {
    const doc = graphToDocument(
      [makeNode('begin', 'start', {}), makeNode('n1', 'note', { text: 'scratch' })],
      [makeEdge('e1', 'begin', 'n1')],
      'Notes'
    )
    expect(doc.components['n1']).toBeUndefined()
    expect(Object.keys(doc.components)).toEqual(['begin'])
  })

  it('maps branch handles via getSourceHandles (switch cases + else)', () => {
    const cases = [
      { id: 'caseA', label: 'A', expression: 'x > 0' },
      { id: 'caseB', label: 'B', expression: 'x < 0' }
    ]
    const form = { cases }
    const nodes = [
      makeNode('begin', 'start', {}),
      makeNode('sw', 'switch', form),
      makeNode('pos', 'agent', {}),
      makeNode('neg', 'agent', {}),
      makeNode('oth', 'agent', {}),
      makeNode('dup', 'agent', {})
    ]
    const edges = [
      makeEdge('e0', 'begin', 'sw'),
      makeEdge('e1', 'sw', 'pos', 'caseA'),
      makeEdge('e2', 'sw', 'dup', 'caseA'),
      makeEdge('e3', 'sw', 'neg', 'caseB'),
      makeEdge('e4', 'sw', 'oth', 'else')
    ]
    const doc = graphToDocument(nodes, edges, 'Branch')
    const params = doc.components['sw']?.obj.params as {
      cases: Array<{ id: string; to: string[] }>
      elseTo: string[]
    }
    expect(params.cases[0]?.to).toEqual(['pos', 'dup'])
    expect(params.cases[1]?.to).toEqual(['neg'])
    expect(params.elseTo).toEqual(['oth'])
    expect(form.cases[0]).not.toHaveProperty('to')
    expect(doc.graph.nodes.find((item) => item.id === 'sw')?.data.form).toEqual({ cases })
  })

  it('maps classifier category handles to params.categories[].to', () => {
    const categories = [
      { id: 'cat1', name: 'Billing', description: 'pay' },
      { id: 'cat2', name: 'Other', description: 'misc' }
    ]
    const doc = graphToDocument(
      [
        makeNode('cg', 'classifier', { categories }),
        makeNode('m1', 'message', { content: 'bill' }),
        makeNode('m2', 'message', { content: 'other' })
      ],
      [makeEdge('e1', 'cg', 'm1', 'cat1'), makeEdge('e2', 'cg', 'm2', 'cat2')],
      'Cats'
    )
    const params = doc.components['cg']?.obj.params as { categories: Array<{ id: string; to: string[] }> }
    expect(params.categories[0]?.to).toEqual(['m1'])
    expect(params.categories[1]?.to).toEqual(['m2'])
  })

  it('strips runtime fields', () => {
    const doc = graphToDocument([makeNode('begin', 'start', {})], [], 'Clean')
    const begin = doc.graph.nodes[0] as FlowNode & { selected?: unknown; dragging?: unknown; measured?: unknown }
    expect(begin.selected).toBeUndefined()
    expect(begin.dragging).toBeUndefined()
    expect(begin.measured).toBeUndefined()
  })
})

describe('documentToGraph / serialize / parse', () => {
  it('round-trips and remaps node.type from kind', () => {
    const nodes = [
      makeNode('begin', 'start', { mode: 'task' }, { type: 'startNode' }),
      makeNode(
        'sw',
        'switch',
        { cases: [{ id: 'c1', label: 'Yes', expression: 'ok' }] },
        { type: 'branchNode', position: { x: 200, y: 80 } }
      ),
      makeNode('n1', 'note', { text: 'memo' }, { type: 'noteNode' })
    ]
    const edges = [makeEdge('e1', 'begin', 'sw'), { ...makeEdge('e2', 'sw', 'n1', 'c1'), type: 'buttonEdge' }]
    const doc = graphToDocument(nodes, edges, 'Round', { sys: true })
    const again = documentToGraph(doc)
    expect(again.nodes.find((item) => item.id === 'sw')?.type).toBe('branchNode')
    expect(again.nodes.find((item) => item.id === 'begin')?.type).toBe('startNode')
    expect(parseDocument(serializeDocument(doc))).toEqual(doc)
  })

  it('round-trips multiple start nodes with id, name, inputs, and position', () => {
    const nodes = [
      makeNode(
        'start',
        'start',
        { inputs: [{ key: 'q', type: 'string', required: true, description: '问' }], mode: 'task' },
        { type: 'startNode', position: { x: 80, y: 240 }, data: { label: 'start', name: 'start', form: {} } }
      ),
      makeNode(
        'start:abc12xyz',
        'start',
        { inputs: [{ key: 'x', type: 'number', required: false, description: '' }], mode: 'conversational' },
        {
          type: 'startNode',
          position: { x: 80, y: 360 },
          data: { label: 'start', name: 'start_1', form: {} }
        }
      )
    ]
    nodes[0].data.name = 'start'
    nodes[0].data.form = { inputs: [{ key: 'q', type: 'string', required: true, description: '问' }], mode: 'task' }
    nodes[1].data.name = 'start_1'
    nodes[1].data.form = {
      inputs: [{ key: 'x', type: 'number', required: false, description: '' }],
      mode: 'conversational'
    }
    const doc = graphToDocument(nodes, [], 'MultiStart')
    const again = documentToGraph(doc)
    const first = again.nodes.find((item) => item.id === 'start')
    const second = again.nodes.find((item) => item.id === 'start:abc12xyz')
    expect(first?.data.name).toBe('start')
    expect(first?.position).toEqual({ x: 80, y: 240 })
    expect(first?.data.form.inputs).toEqual([{ key: 'q', type: 'string', required: true, description: '问' }])
    expect(second?.data.name).toBe('start_1')
    expect(second?.position).toEqual({ x: 80, y: 360 })
    expect(second?.data.form.inputs).toEqual([{ key: 'x', type: 'number', required: false, description: '' }])
    expect(again.nodes.filter((item) => item.data.label === 'start')).toHaveLength(2)
  })

  it('migrates legacy labels and recomputes node.type', () => {
    const doc = graphToDocument(
      [makeNode('begin', 'Begin', {}), makeNode('Agent:x1', 'Agent', { model: 'gpt' })],
      [makeEdge('e1', 'begin', 'Agent:x1')],
      'Fill'
    )
    for (const item of doc.graph.nodes) delete item.type
    for (const item of doc.graph.edges) delete item.type
    const { nodes, edges } = documentToGraph(doc)
    expect(nodes.find((item) => item.id === 'begin')?.data.label).toBe('start')
    expect(nodes.find((item) => item.id === 'begin')?.type).toBe('startNode')
    expect(nodes.find((item) => item.id === 'Agent:x1')?.data.label).toBe('agent')
    expect(nodes.find((item) => item.id === 'Agent:x1')?.type).toBe('taskNode')
    expect(edges[0]?.type).toBe('buttonEdge')
  })

  it('throws a clear error for illegal documents', () => {
    expect(() => parseDocument('not-json')).toThrow(/malformed JSON/)
    expect(() => parseDocument('{"title":"x"}')).toThrow(/version 1/)
    expect(() =>
      documentToGraph({
        version: 2,
        title: 'x',
        graph: { nodes: [], edges: [] },
        components: {},
        globals: {}
      } as unknown as FlowDocument)
    ).toThrow(/version must be 1/)
    expect(() =>
      documentToGraph({ version: 1, title: 'x', components: {}, globals: {} } as unknown as FlowDocument)
    ).toThrow(/graph is required/)
    expect(() =>
      documentToGraph({
        version: 1,
        title: 'x',
        graph: { nodes: [{ id: 'n1', position: { x: 0, y: 0 } }], edges: [] },
        components: {},
        globals: {}
      } as unknown as FlowDocument)
    ).toThrow(/missing data/)
  })

  it('imports a RAGFlow-style document without version', () => {
    const raw = readFileSync(join(fixtureDir, 'fixtures/ragflow-sample.json'), 'utf8')
    const doc = parseDocument(raw)
    expect(doc.version).toBe(1)
    const { nodes, edges } = documentToGraph(doc)
    const wiki = nodes.find((item) => item.id === 'Wikipedia:wiki1ddd')
    expect(wiki?.data.label).toBe('custom')
    expect(wiki?.data.description).toBe('原类型: Wikipedia')
    expect(wiki?.type).toBe('taskNode')
    expect(nodes.find((item) => item.id === 'begin')?.data.label).toBe('start')
    expect(nodes.find((item) => item.id === 'Switch:sw01aaaa')?.data.label).toBe('switch')
    expect(nodes.find((item) => item.id === 'Categorize:cat1cccc')?.data.label).toBe('classifier')
    expect(nodes.find((item) => item.id === 'Message:msg1bbbb')?.data.label).toBe('message')
    const cases = nodes.find((item) => item.id === 'Switch:sw01aaaa')?.data.form.cases as Array<{
      id: string
      expression: string
    }>
    expect(cases[0]).toMatchObject({ id: 'Case 1', expression: 'sys.query = billing' })
    expect(edges.find((item) => item.id === 'e3')?.sourceHandle).toBe('else')
  })

  it('restores parentId from components.parent_id', () => {
    const doc = graphToDocument(
      [
        makeNode('loop', 'foreach', { items: '{{sys.files}}' }),
        makeNode('inner', 'code', { code: '1' }, { parentId: 'loop' })
      ],
      [],
      'Nest'
    )
    for (const item of doc.graph.nodes) {
      delete item.parentId
    }
    const { nodes } = documentToGraph(doc)
    const inner = nodes.find((item) => item.id === 'inner')
    expect(inner?.parentId).toBe('loop')
    // 归属只靠 parentId；不设 extent，否则无法把节点拖出容器。
    expect(inner?.extent).toBeUndefined()
  })

  it('round-trips a dataset node form including fields and inline_data', () => {
    const fields = [
      { key: 'id', type: 'string', required: true, description: '主键' },
      { key: 'payload', type: 'object', required: false, description: '' }
    ]
    const inline_data = { rows: [{ id: '1', payload: { ok: true } }] }
    const form = {
      data_type: 'table',
      source: 'inline',
      fields,
      inline_data,
      format: 'json',
      description: '用户初始数据集',
      sample_limit: 20
    }
    const nodes = [makeNode('ds1', 'dataset', form, { type: 'taskNode' })]
    const doc = graphToDocument(nodes, [], 'DatasetRoundtrip')
    expect(doc.components['ds1']?.obj.component_name).toBe('dataset')
    expect(doc.components['ds1']?.obj.params).toEqual(form)
    expect(doc.graph.nodes.find((item) => item.id === 'ds1')?.data.form).toEqual(form)

    const again = documentToGraph(doc)
    expect(again.nodes.find((item) => item.id === 'ds1')?.data.form).toEqual(form)
    expect(again.nodes.find((item) => item.id === 'ds1')?.type).toBe('taskNode')
    expect(parseDocument(serializeDocument(doc))).toEqual(doc)
  })

  it('strips a legacy extent flag from container children', () => {
    const doc = graphToDocument(
      [
        makeNode('loop', 'foreach', { items: '{{sys.files}}' }),
        makeNode('inner', 'code', { code: '1' }, { parentId: 'loop', extent: 'parent' })
      ],
      [],
      'Legacy'
    )
    const { nodes } = documentToGraph(doc)
    expect(nodes.find((item) => item.id === 'inner')?.extent).toBeUndefined()
  })
})

function listExampleFlowFiles(): string[] {
  const roots = [join(process.cwd(), 'examples')]
  const privateDir = join(roots[0], 'private')
  if (existsSync(privateDir)) roots.push(privateDir)
  return roots.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith('.flow.json'))
      .map((name) => join(dir, name))
  )
}

describe('examples/*.flow.json', () => {
  it('parses every example; containers keep children (no extent) and a loop-start', () => {
    const files = listExampleFlowFiles()
    if (files.length === 0) return
    for (const file of files) {
      const doc = parseDocument(readFileSync(file, 'utf8'))
      const graph = documentToGraph(doc)
      expect(graph.title.length).toBeGreaterThan(0)
      expect(graph.nodes.some((item) => item.id === 'start')).toBe(true)
      for (const item of graph.nodes) {
        expect(item.extent).toBeUndefined()
      }
      const containers = graph.nodes.filter((item) => item.type === 'containerNode')
      for (const container of containers) {
        const children = graph.nodes.filter((item) => item.parentId === container.id)
        expect(children.length).toBeGreaterThan(0)
        expect(children.some((item) => item.type === 'loopStartNode')).toBe(true)
      }
    }
  })
})
