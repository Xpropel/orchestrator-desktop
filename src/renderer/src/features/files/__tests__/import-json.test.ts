import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { documentToGraph, parseDocument } from '@/core/dsl'
import { fileApi } from '@/platform/platform'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'
import { importJson, importJsonFromText } from '../file-actions'
import { normalizeImportedJson } from '../import-json'

const fixtureDir = dirname(fileURLToPath(import.meta.url))
const templateText = readFileSync(join(fixtureDir, 'fixtures/ragflow-template.json'), 'utf8')
const template = JSON.parse(templateText) as {
  title: { zh: string; en: string }
  dsl: { graph: { nodes: unknown[]; edges: unknown[] } }
}

const nativeDoc = {
  version: 1 as const,
  title: '我的流程',
  graph: {
    nodes: [
      {
        id: 'start',
        type: 'startNode',
        position: { x: 0, y: 0 },
        data: { label: 'start', name: 'start', form: {} }
      }
    ],
    edges: []
  },
  components: {},
  globals: {}
}

describe('normalizeImportedJson', () => {
  it('recognizes a native FlowDocument and keeps its title', () => {
    const result = normalizeImportedJson(JSON.stringify(nativeDoc), 'other.json')
    expect(result.kind).toBe('native')
    expect(result.title).toBe('我的流程')
    expect(result.unknownLabels).toEqual([])
  })

  it('unwraps a RAGFlow template and takes the outer title', () => {
    const result = normalizeImportedJson(templateText, 'web_search_assistant.json')
    expect(result.kind).toBe('ragflow-wrapped')
    expect(result.title).toBe(template.title.zh)
    expect(result.unknownLabels).toContain('Tool')

    const doc = parseDocument(result.content)
    const graph = documentToGraph(doc)
    expect(graph.nodes).toHaveLength(template.dsl.graph.nodes.length)
    expect(graph.nodes.some((node) => node.id === 'begin' && node.data.label === 'start')).toBe(true)
  })

  it('recognizes the exported DSL body as ragflow', () => {
    const result = normalizeImportedJson(JSON.stringify(template.dsl), 'exported.json')
    expect(result.kind).toBe('ragflow')
    expect(result.unknownLabels).toContain('Tool')
    expect(parseDocument(result.content).graph.nodes).toHaveLength(template.dsl.graph.nodes.length)
  })

  it('wraps a bare {nodes, edges} graph', () => {
    const result = normalizeImportedJson(
      JSON.stringify({ nodes: nativeDoc.graph.nodes, edges: [] }),
      'bare.json'
    )
    expect(result.kind).toBe('graph-only')
    expect(result.title).toBe('bare')
    const parsed = JSON.parse(result.content) as { graph: { nodes: unknown[] }; components: unknown }
    expect(parsed.graph.nodes).toHaveLength(1)
    expect(parsed.components).toEqual({})
  })

  it('falls back to the file name when the document has no title', () => {
    const result = normalizeImportedJson(
      JSON.stringify({ graph: { nodes: [], edges: [] }, components: {} }),
      'C:/tmp/my-flow.flow.json'
    )
    expect(result.kind).toBe('ragflow')
    expect(result.title).toBe('my-flow')
  })

  it('throws for illegal JSON', () => {
    expect(() => normalizeImportedJson('{', 'bad.json')).toThrow('不是合法的 JSON 文件')
  })

  it('throws for an unrecognized structure', () => {
    expect(() => normalizeImportedJson('{"foo":1}', 'bad.json')).toThrow(
      '无法识别的 JSON 结构：需要流程文档、RAGFlow DSL 或 {nodes, edges}'
    )
  })
})

describe('importJson', () => {
  beforeEach(() => {
    useFlowStore.getState().resetToEmpty()
    useUiStore.setState({ toast: null, inspectorNodeId: 'old' })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads a native file from disk like Open (keeps path, not dirty)', async () => {
    const toast = vi.spyOn(useUiStore.getState(), 'showToast')
    vi.spyOn(fileApi, 'openFlow').mockResolvedValue({
      filePath: 'C:/tmp/demo.flow.json',
      content: JSON.stringify(nativeDoc)
    })

    await importJson()

    expect(fileApi.openFlow).toHaveBeenCalledWith('导入 JSON')
    expect(useFlowStore.getState().title).toBe('我的流程')
    expect(useFlowStore.getState().filePath).toBe('C:/tmp/demo.flow.json')
    expect(useFlowStore.getState().dirty).toBe(false)
    expect(useUiStore.getState().inspectorNodeId).toBeNull()
    expect(toast).toHaveBeenCalledWith('已导入「我的流程」：1 个节点、0 条边')
  })

  it('loads a native document from text as untitled and dirty', async () => {
    const toast = vi.spyOn(useUiStore.getState(), 'showToast')
    await importJsonFromText(JSON.stringify(nativeDoc), 'drop-demo.flow.json')

    expect(useFlowStore.getState().filePath).toBeNull()
    expect(useFlowStore.getState().dirty).toBe(true)
    expect(useFlowStore.getState().title).toBe('我的流程')
    expect(toast).toHaveBeenCalledWith('已导入「我的流程」：1 个节点、0 条边')
  })

  it('loads RAGFlow JSON as untitled and dirty so Save becomes Save As', async () => {
    const toast = vi.spyOn(useUiStore.getState(), 'showToast')
    await importJsonFromText(templateText, 'web_search_assistant.json')

    expect(useFlowStore.getState().filePath).toBeNull()
    expect(useFlowStore.getState().dirty).toBe(true)
    expect(useFlowStore.getState().title).toBe(template.title.zh)
    expect(useFlowStore.getState().nodes.some((node) => node.id === 'begin')).toBe(true)
    const message = toast.mock.calls[0]?.[0] ?? ''
    expect(message).toContain(`已导入「${template.title.zh}」`)
    expect(message).toContain('种算子暂无对应实现，已按「自定义」保留：Tool')
  })

  it('alerts on illegal JSON and leaves the canvas alone', async () => {
    const alert = vi.fn()
    vi.stubGlobal('window', { alert })
    const title = useFlowStore.getState().title
    vi.spyOn(fileApi, 'openFlow').mockResolvedValue({
      filePath: 'bad.json',
      content: '{'
    })

    await importJson()

    expect(alert).toHaveBeenCalledWith('不是合法的 JSON 文件')
    expect(useFlowStore.getState().title).toBe(title)
  })

  it('stops when the user cancels the dirty confirmation', async () => {
    useFlowStore.getState().setTitle('脏了')
    vi.spyOn(fileApi, 'confirmUnsaved').mockResolvedValue('cancel')
    const open = vi.spyOn(fileApi, 'openFlow')

    await importJson()

    expect(open).not.toHaveBeenCalled()
    expect(useFlowStore.getState().title).toBe('脏了')
  })
})
