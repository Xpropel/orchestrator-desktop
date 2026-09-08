import { migrateLabel, resolveOperatorType } from '@/core/migrations'
import { hasOperator } from '@/core/registry'
import { isRecord } from '@/core/schema'

export type ImportedJsonKind = 'native' | 'ragflow' | 'ragflow-wrapped' | 'graph-only'

export interface NormalizedImport {
  content: string
  title: string
  kind: ImportedJsonKind
  unknownLabels: string[]
}

/** 从导入 JSON 识别四种形状，并补齐 parseDocument 所需字段。 */
export function normalizeImportedJson(text: string, fileName: string): NormalizedImport {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('不是合法的 JSON 文件')
  }
  if (!isRecord(parsed)) {
    throw unrecognizedStructure()
  }

  const fallbackTitle = titleFromFileName(fileName)

  if (parsed.version === 1) {
    return {
      content: text,
      title: pickTitle(parsed.title) || fallbackTitle,
      kind: 'native',
      unknownLabels: collectUnknownLabels(nodesOf(graphOf(parsed)))
    }
  }

  if (isRecord(parsed.dsl) && hasGraphNodes(parsed.dsl)) {
    const dsl: Record<string, unknown> = { ...parsed.dsl, components: asComponents(parsed.dsl.components) }
    const title = pickTitle(parsed.title) || pickTitle(dsl.title) || fallbackTitle
    return {
      content: JSON.stringify({ ...dsl, title }),
      title,
      kind: 'ragflow-wrapped',
      unknownLabels: collectUnknownLabels(nodesOf(graphOf(dsl)))
    }
  }

  if (hasGraphNodes(parsed)) {
    const title = pickTitle(parsed.title) || fallbackTitle
    return {
      content: JSON.stringify({
        ...parsed,
        title,
        components: asComponents(parsed.components)
      }),
      title,
      kind: 'ragflow',
      unknownLabels: collectUnknownLabels(nodesOf(graphOf(parsed)))
    }
  }

  if (Array.isArray(parsed.nodes)) {
    const edges = Array.isArray(parsed.edges) ? parsed.edges : []
    const title = pickTitle(parsed.title) || fallbackTitle
    return {
      content: JSON.stringify({
        graph: { nodes: parsed.nodes, edges },
        components: {},
        title
      }),
      title,
      kind: 'graph-only',
      unknownLabels: collectUnknownLabels(parsed.nodes)
    }
  }

  throw unrecognizedStructure()
}

function unrecognizedStructure(): Error {
  return new Error('无法识别的 JSON 结构：需要流程文档、RAGFlow DSL 或 {nodes, edges}')
}

function hasGraphNodes(value: Record<string, unknown>): boolean {
  return Array.isArray(graphOf(value)?.nodes)
}

function graphOf(value: Record<string, unknown>): Record<string, unknown> | null {
  return isRecord(value.graph) ? value.graph : null
}

function nodesOf(graph: Record<string, unknown> | null): unknown {
  return graph?.nodes
}

function asComponents(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

/** 文档内 title → 去后缀文件名 → Untitled。外层 i18n 对象取 zh/en。 */
export function pickTitle(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  if (!isRecord(value)) {
    return ''
  }
  for (const key of ['zh', 'en', 'de']) {
    const part = value[key]
    if (typeof part === 'string' && part.trim().length > 0) {
      return part.trim()
    }
  }
  for (const part of Object.values(value)) {
    if (typeof part === 'string' && part.trim().length > 0) {
      return part.trim()
    }
  }
  return ''
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? ''
  const stripped = base.replace(/\.flow\.json$/i, '').replace(/\.json$/i, '')
  return stripped.length > 0 ? stripped : 'Untitled'
}

/** RAGFlow 节点经 resolveOperatorType 落到 custom、且库中无对应实现的原始 label。 */
function collectUnknownLabels(nodes: unknown): string[] {
  if (!Array.isArray(nodes)) {
    return []
  }
  const seen = new Set<string>()
  const labels: string[] = []
  for (const node of nodes) {
    if (!isRecord(node) || !isRecord(node.data) || typeof node.data.label !== 'string') {
      continue
    }
    const label = node.data.label
    if (label.length === 0) {
      continue
    }
    const migrated = migrateLabel(label)
    if (resolveOperatorType(label) === 'custom' && !hasOperator(migrated) && !seen.has(label)) {
      seen.add(label)
      labels.push(label)
    }
  }
  return labels
}
