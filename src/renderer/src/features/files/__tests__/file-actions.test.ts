import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { documentToGraph, graphToDocument, parseDocument, serializeDocument } from '@/core/dsl'
import { createOperatorNode } from '@/core/graph'
import { loadLibrary } from '@/core/library'
import { fileApi } from '@/platform/platform'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'
import {
  importJsonFromText,
  loadFlowFromText,
  newFlow,
  openExampleFlow,
  serializeCurrentFlow
} from '../file-actions'

beforeAll(() => {
  loadLibrary()
})

describe('loadFlowFromText', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
    useUiStore.setState({ inspectorNodeId: null, openCategory: null })
    vi.restoreAllMocks()
  })

  it('loads JSON with a null filePath so Save falls back to Save As', () => {
    const extra = createOperatorNode('message', { x: 400, y: 80 }, useFlowStore.getState().nodes)
    extra.data = { ...extra.data, form: { content: 'hello' } }
    const nodes = [...useFlowStore.getState().nodes, extra]
    const json = serializeDocument(graphToDocument(nodes, [], 'FromText', {}))
    useFlowStore.getState().addNode(createOperatorNode('agent', { x: 10, y: 10 }, nodes))
    loadFlowFromText(json, null)
    expect(useFlowStore.getState().filePath).toBeNull()
    expect(useFlowStore.getState().title).toBe('FromText')
    expect(useFlowStore.getState().dirty).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'message')).toBe(true)
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'agent')).toBe(false)
  })

  it('bumps viewportRequest and closes inspector plus category flyout', () => {
    const extra = createOperatorNode('message', { x: 400, y: 80 }, useFlowStore.getState().nodes)
    extra.data = { ...extra.data, form: { content: 'hello' } }
    const json = serializeDocument(graphToDocument([...useFlowStore.getState().nodes, extra], [], 'FromText', {}))
    useUiStore.setState({ inspectorNodeId: 'old', openCategory: 'logic' })
    const before = useFlowStore.getState().viewportRequest
    loadFlowFromText(json, null)
    expect(useFlowStore.getState().viewportRequest).toBe(before + 1)
    expect(useUiStore.getState().inspectorNodeId).toBeNull()
    expect(useUiStore.getState().openCategory).toBeNull()
  })
})

describe('newFlow / openExampleFlow overlays', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
    useUiStore.setState({ inspectorNodeId: null, openCategory: null })
    vi.restoreAllMocks()
  })

  it('newFlow after discard bumps viewportRequest and closes leftover UI', async () => {
    useFlowStore.getState().addNode(createOperatorNode('agent', { x: 10, y: 10 }, useFlowStore.getState().nodes))
    useUiStore.setState({ inspectorNodeId: 'old', openCategory: 'logic' })
    vi.spyOn(fileApi, 'confirmUnsaved').mockResolvedValue('discard')
    const before = useFlowStore.getState().viewportRequest
    await newFlow()
    expect(useFlowStore.getState().viewportRequest).toBe(before + 1)
    expect(useFlowStore.getState().title).toBe('Untitled')
    expect(useUiStore.getState().inspectorNodeId).toBeNull()
    expect(useUiStore.getState().openCategory).toBeNull()
  })

  it('openExampleFlow after unsaved discard loads the template and bumps viewportRequest', async () => {
    useFlowStore.getState().addNode(createOperatorNode('agent', { x: 10, y: 10 }, useFlowStore.getState().nodes))
    useUiStore.setState({ inspectorNodeId: 'old', openCategory: 'logic' })
    vi.spyOn(fileApi, 'confirmUnsaved').mockResolvedValue('discard')
    const before = useFlowStore.getState().viewportRequest
    const ok = await openExampleFlow('foreach-http-summary')
    expect(ok).toBe(true)
    expect(fileApi.confirmUnsaved).toHaveBeenCalled()
    expect(useFlowStore.getState().viewportRequest).toBeGreaterThan(before)
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'foreach')).toBe(true)
    expect(useUiStore.getState().inspectorNodeId).toBeNull()
    expect(useUiStore.getState().openCategory).toBeNull()
  })

  it('openExampleFlow cancel leaves the canvas and leftover UI in place', async () => {
    useFlowStore.getState().addNode(createOperatorNode('agent', { x: 10, y: 10 }, useFlowStore.getState().nodes))
    useUiStore.setState({ inspectorNodeId: 'old', openCategory: 'logic' })
    vi.spyOn(fileApi, 'confirmUnsaved').mockResolvedValue('cancel')
    const before = useFlowStore.getState().viewportRequest
    const title = useFlowStore.getState().title
    expect(await openExampleFlow('foreach-http-summary')).toBe(false)
    expect(useFlowStore.getState().viewportRequest).toBe(before)
    expect(useFlowStore.getState().title).toBe(title)
    expect(useUiStore.getState().inspectorNodeId).toBe('old')
    expect(useUiStore.getState().openCategory).toBe('logic')
  })
})

describe('serializeCurrentFlow after copy-paste', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
    useUiStore.setState({ inspectorNodeId: null, openCategory: null })
  })

  it('keeps remapped ids and parentIds through serializeCurrentFlow and documentToGraph', () => {
    const box = createOperatorNode('foreach', { x: 200, y: 80 }, useFlowStore.getState().nodes)
    useFlowStore.getState().addNode(box)
    const inner = createOperatorNode('agent', { x: 40, y: 90 }, useFlowStore.getState().nodes, {
      parentId: box.id
    })
    inner.data = { ...inner.data, name: 'agent_1', form: { prompt: 'hi', model: 'm' } }
    useFlowStore.getState().addNode(inner)
    useFlowStore.getState().selectNode(box.id)
    useFlowStore.getState().copySelected()
    useFlowStore.getState().selectNode(null)
    useFlowStore.getState().pasteClipboard()

    const copies = useFlowStore.getState().nodes.filter((node) => node.data.label === 'foreach')
    const pasted = copies.find((node) => node.id !== box.id)
    expect(pasted).toBeDefined()
    const pastedChildren = useFlowStore.getState().nodes.filter((node) => node.parentId === pasted?.id)
    expect(pastedChildren.length).toBeGreaterThan(0)
    expect(pastedChildren.some((node) => node.id === inner.id)).toBe(false)
    expect(pastedChildren.some((node) => node.type === 'loopStartNode')).toBe(true)

    const text = serializeCurrentFlow()
    const parsed = parseDocument(text)
    const graph = documentToGraph(parsed)
    expect(graph.nodes.find((node) => node.id === pasted?.id)).toBeDefined()
    expect(graph.nodes.filter((node) => node.parentId === pasted?.id).map((node) => node.id).sort()).toEqual(
      pastedChildren.map((node) => node.id).sort()
    )
    expect(parsed.components[pastedChildren[0]!.id]?.parent_id).toBe(pasted?.id)
    expect(graph.nodes.every((node) => node.extent === undefined)).toBe(true)
    const raw = JSON.parse(text) as { graph: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> } }
    for (const item of [...raw.graph.nodes, ...raw.graph.edges]) {
      expect(item).not.toHaveProperty('selected')
      expect(item).not.toHaveProperty('measured')
      expect(item).not.toHaveProperty('dragging')
      expect(item).not.toHaveProperty('extent')
    }
  })
})

describe('import errors stay safe', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
    useUiStore.setState({ inspectorNodeId: null, openCategory: null, toast: null })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('importJsonFromText of malformed JSON alerts and leaves the store usable', async () => {
    const alert = vi.fn()
    vi.stubGlobal('window', { alert })
    useFlowStore.getState().setTitle('KeepMe')
    const extra = createOperatorNode('message', { x: 40, y: 40 }, useFlowStore.getState().nodes)
    extra.data = { ...extra.data, form: { content: 'stay' } }
    useFlowStore.getState().addNode(extra)
    vi.spyOn(fileApi, 'confirmUnsaved').mockResolvedValue('discard')
    const nodeCount = useFlowStore.getState().nodes.length

    await importJsonFromText('{', 'bad.json')

    expect(alert).toHaveBeenCalledWith('不是合法的 JSON 文件')
    expect(useFlowStore.getState().title).toBe('KeepMe')
    expect(useFlowStore.getState().nodes).toHaveLength(nodeCount)
    expect(() =>
      useFlowStore.getState().addNode(createOperatorNode('agent', { x: 80, y: 80 }, useFlowStore.getState().nodes))
    ).not.toThrow()
  })

  it('importJsonFromText of a document without start does not throw or brick the store', async () => {
    const toast = vi.spyOn(useUiStore.getState(), 'showToast')
    const noStart = JSON.stringify({
      version: 1,
      title: 'NoStartImport',
      graph: {
        nodes: [
          {
            id: 'm1',
            type: 'taskNode',
            position: { x: 0, y: 0 },
            data: { label: 'message', name: 'Msg_1', form: { content: 'hi' } }
          }
        ],
        edges: []
      },
      components: {},
      globals: {}
    })
    await importJsonFromText(noStart, 'nostart.json')
    expect(useFlowStore.getState().title).toBe('NoStartImport')
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'start')).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'm1')).toBe(true)
    expect(toast).toHaveBeenCalled()
    expect(() => useFlowStore.getState().resetToEmpty()).not.toThrow()
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'start')).toBe(true)
  })

  it('loadFlowFromText of a document without start does not throw or brick the store', () => {
    const noStart = JSON.stringify({
      version: 1,
      title: 'NoStart',
      graph: {
        nodes: [
          {
            id: 'm1',
            type: 'taskNode',
            position: { x: 0, y: 0 },
            data: { label: 'message', name: 'Msg_1', form: { content: 'hi' } }
          }
        ],
        edges: []
      },
      components: {},
      globals: {}
    })
    expect(() => loadFlowFromText(noStart, null)).not.toThrow()
    expect(useFlowStore.getState().title).toBe('NoStart')
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'start')).toBe(false)
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'm1')).toBe(true)
    expect(() => useFlowStore.getState().resetToEmpty()).not.toThrow()
    expect(useFlowStore.getState().nodes.some((node) => node.data.label === 'start')).toBe(true)
  })

  it('loadFlowFromText of malformed JSON throws and leaves the previous document', () => {
    const title = useFlowStore.getState().title
    const count = useFlowStore.getState().nodes.length
    expect(() => loadFlowFromText('{', null)).toThrow(/malformed JSON/)
    expect(useFlowStore.getState().title).toBe(title)
    expect(useFlowStore.getState().nodes).toHaveLength(count)
    expect(() => useFlowStore.getState().addNode(createOperatorNode('code', { x: 10, y: 10 }, useFlowStore.getState().nodes))).not.toThrow()
  })
})
