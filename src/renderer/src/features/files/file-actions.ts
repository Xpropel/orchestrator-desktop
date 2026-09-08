import { downloadText, fileApi } from '@/platform/platform'
import { documentToGraph, graphToDocument, parseDocument, serializeDocument } from '@/core/dsl'
import { snapshotOf, titleFromPath } from '@/state/flow-helpers'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'
import { clearRecoverySnapshot } from './crash-recovery'
import { normalizeImportedJson, titleFromFileName } from './import-json'

const PATH_NOT_ALLOWED = 'PATH_NOT_ALLOWED'

/** 当前画布序列化为落盘 JSON 文本。 */
export function serializeCurrentFlow(): string {
  const { nodes, edges, title, globals } = useFlowStore.getState()
  return serializeDocument(graphToDocument(nodes, edges, title, globals))
}

/**
 * 解析 JSON 文本并载入画布。`filePath` 为 null 表示来源不是磁盘文件（示例、恢复）。
 * 之后「保存」会退化为「另存为」。解析失败抛出 Error。 */
export function loadFlowFromText(content: string, filePath: string | null): void {
  const fallbackTitle = filePath ? titleFromPath(filePath) : titleFromFileName('untitled.json')
  const doc = parseDocument(content, { fallbackTitle })
  const graph = documentToGraph(doc)
  const title = graph.title.trim().length > 0 ? graph.title : fallbackTitle
  useFlowStore.getState().loadDocument(
    {
      ...doc,
      title,
      graph: { nodes: graph.nodes, edges: graph.edges },
      globals: doc.globals ?? {}
    },
    filePath
  )
  // 换了文档，属性面板不能继续指着旧节点（哪怕新文档恰好有同名 id）。
  useUiStore.getState().closeInspector()
}

function captureSavePayload(): { content: string; written: ReturnType<typeof snapshotOf> } {
  const { nodes, edges, title, globals } = useFlowStore.getState()
  const written = snapshotOf(nodes, edges, title, globals)
  return {
    content: serializeDocument(graphToDocument(written.nodes, written.edges, written.title, written.globals)),
    written
  }
}

function report(result: 'saved' | 'cancelled' | 'failed'): void {
  fileApi.reportSaveResult(result)
}

async function confirmIfDirty(): Promise<boolean> {
  if (!useFlowStore.getState().dirty) {
    return true
  }
  const choice = await fileApi.confirmUnsaved('当前流程有未保存的更改，是否保存？')
  if (choice === 'cancel') {
    return false
  }
  if (choice === 'save') {
    return saveFlow()
  }
  return true
}

export async function newFlow(): Promise<void> {
  if (!(await confirmIfDirty())) {
    return
  }
  useFlowStore.getState().resetToEmpty()
  useUiStore.getState().closeInspector()
  void clearRecoverySnapshot()
}

export async function openFlow(filePath?: string): Promise<void> {
  if (!(await confirmIfDirty())) {
    return
  }

  let result: { filePath: string; content: string } | null
  try {
    result = filePath ? await fileApi.readFlow(filePath) : await fileApi.openFlow()
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法打开文件'
    if (filePath && message === PATH_NOT_ALLOWED) {
      window.alert(`无法打开文件：${filePath}`)
      return
    }
    window.alert(message)
    return
  }

  if (!result) {
    if (filePath) {
      window.alert(`无法打开文件：${filePath}`)
    }
    return
  }

  try {
    loadFlowFromText(result.content, result.filePath)
    void clearRecoverySnapshot()
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法解析该文件'
    window.alert(message)
  }
}

// ---------------------------------------------------------------------------
// 示例模板库：`examples/*.flow.json` 在构建期随渲染进程打包，Electron 与浏览器模式均可用。
// ---------------------------------------------------------------------------

export interface ExampleFlow {
  name: string
  title: string
  description: string
}

interface ExampleManifestEntry extends ExampleFlow {
  file: string
}

// `@examples` 别名在 electron.vite.config.ts / vite.config.web.ts 中指向项目根的 examples/；
// 不用相对路径，避免文件搬家后 glob 悄悄匹配到空集合。
const publicManifestModules = import.meta.glob('@examples/index.json', {
  eager: true,
  import: 'default'
}) as Record<string, unknown>

const publicFlowModules = import.meta.glob('@examples/*.flow.json', {
  eager: true,
  import: 'default'
}) as Record<string, unknown>

async function loadPrivateExampleModules(): Promise<{
  manifest: Record<string, unknown>
  flows: Record<string, unknown>
}> {
  if (!import.meta.env.DEV) {
    return { manifest: {}, flows: {} }
  }
  const mod = await import('./example-modules.private')
  return { manifest: mod.privateManifestModules, flows: mod.privateFlowModules }
}

if (import.meta.env.DEV && Object.keys(publicManifestModules).length === 0) {
  console.error('[examples] 未找到 examples/index.json，请检查 @examples 别名与目录')
}

function isManifestEntry(value: unknown): value is ExampleManifestEntry {
  if (!value || typeof value !== 'object') {
    return false
  }
  const entry = value as Record<string, unknown>
  return (
    typeof entry.name === 'string' &&
    typeof entry.file === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.description === 'string'
  )
}

function entriesOf(raw: unknown): ExampleManifestEntry[] {
  return Array.isArray(raw) ? raw.filter(isManifestEntry) : []
}

async function readExampleManifest(): Promise<ExampleManifestEntry[]> {
  const publicEntries = entriesOf(Object.values(publicManifestModules)[0])
  const { manifest } = await loadPrivateExampleModules()
  const privateEntries = entriesOf(Object.values(manifest)[0])
  return [...publicEntries, ...privateEntries]
}

export async function listExampleFlows(): Promise<ExampleFlow[]> {
  return (await readExampleManifest()).map(({ name, title, description }) => ({ name, title, description }))
}

/** 载入内置示例；返回是否成功（用户取消或示例缺失返回 false）。 */
export async function openExampleFlow(name: string): Promise<boolean> {
  const entry = (await readExampleManifest()).find((item) => item.name === name)
  if (!entry) {
    window.alert(`示例不存在：${name}`)
    return false
  }
  const { flows } = await loadPrivateExampleModules()
  const exampleFlowModules = { ...publicFlowModules, ...flows }
  const key = Object.keys(exampleFlowModules).find((path) => path.endsWith(`/${entry.file}`))
  const content = key ? exampleFlowModules[key] : undefined
  if (content === undefined) {
    window.alert(`示例文件缺失：${entry.file}`)
    return false
  }
  if (!(await confirmIfDirty())) {
    return false
  }
  try {
    loadFlowFromText(JSON.stringify(content), null)
    void clearRecoverySnapshot()
    return true
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '示例文件无法解析')
    return false
  }
}

export async function saveFlow(options?: { silent?: boolean }): Promise<boolean> {
  const { filePath } = useFlowStore.getState()
  if (!filePath) {
    if (options?.silent) {
      return false
    }
    return saveFlowAs()
  }

  try {
    const { content, written } = captureSavePayload()
    await fileApi.saveFlow(filePath, content)
    useFlowStore.getState().markSaved(filePath, written)
    report('saved')
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败'
    if (options?.silent) {
      report('failed')
      throw error instanceof Error ? error : new Error(message)
    }
    if (message === PATH_NOT_ALLOWED) {
      return saveFlowAs()
    }
    window.alert(message)
    report('failed')
    return false
  }
}

export async function saveFlowAs(): Promise<boolean> {
  const { filePath, title } = useFlowStore.getState()
  const defaultName = (filePath?.split(/[/\\]/).pop() ?? `${title}.flow.json`) || 'untitled.flow.json'

  try {
    const { content, written } = captureSavePayload()
    const nextPath = await fileApi.saveFlowAs(content, defaultName)
    if (!nextPath) {
      report('cancelled')
      return false
    }
    useFlowStore.getState().markSaved(nextPath, written)
    report('saved')
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : '另存为失败'
    window.alert(message)
    report('failed')
    return false
  }
}

export function exportJson(): void {
  const { title } = useFlowStore.getState()
  downloadText(`${title || 'untitled'}.flow.json`, serializeCurrentFlow())
}

/** 选文件导入 JSON（原生文档保留路径；其余形状另存为）。 */
export async function importJson(): Promise<void> {
  if (!(await confirmIfDirty())) {
    return
  }

  let result: { filePath: string; content: string } | null
  try {
    result = await fileApi.openFlow('导入 JSON')
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '无法打开文件')
    return
  }
  if (!result) {
    return
  }
  applyImportedJson(result.content, fileNameOf(result.filePath), result.filePath)
}

/** 拖入或测试用：不带磁盘路径，保存时走另存为。 */
export async function importJsonFromText(text: string, fileName: string): Promise<void> {
  if (!(await confirmIfDirty())) {
    return
  }
  applyImportedJson(text, fileName, null)
}

function fileNameOf(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath
}

function applyImportedJson(text: string, fileName: string, filePath: string | null): void {
  try {
    const normalized = normalizeImportedJson(text, fileName)
    const keepPath = normalized.kind === 'native' && filePath !== null
    if (keepPath) {
      loadFlowFromText(normalized.content, filePath)
    } else {
      loadFlowFromText(normalized.content, null)
      if (useFlowStore.getState().title !== normalized.title) {
        useFlowStore.getState().setTitle(normalized.title)
      }
      useFlowStore.getState().markUnsaved()
    }
    void clearRecoverySnapshot()

    const { nodes, edges } = useFlowStore.getState()
    let message = `已导入「${normalized.title}」：${nodes.length} 个节点、${edges.length} 条边`
    if (normalized.unknownLabels.length > 0) {
      message += `，${normalized.unknownLabels.length} 种算子暂无对应实现，已按「自定义」保留：${normalized.unknownLabels.join('、')}`
    }
    useUiStore.getState().showToast(message)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '无法解析该文件')
  }
}
