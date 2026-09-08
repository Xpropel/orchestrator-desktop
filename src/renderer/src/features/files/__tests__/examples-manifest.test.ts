import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const EXAMPLES_DIR = join(__dirname, '..', '..', '..', '..', '..', '..', 'examples')

interface ManifestEntry {
  name: string
  file: string
  title: string
  description: string
}

function readManifest(): ManifestEntry[] {
  const raw: unknown = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'index.json'), 'utf8'))
  expect(Array.isArray(raw)).toBe(true)
  return raw as ManifestEntry[]
}

function readExample(file: string): {
  version: number
  title: string
  graph: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> }
  components: Record<string, { upstream: string[]; downstream: string[]; parent_id?: string }>
} {
  return JSON.parse(readFileSync(join(EXAMPLES_DIR, file), 'utf8'))
}

describe('examples/index.json', () => {
  it('lists every *.flow.json exactly once with complete metadata', () => {
    const manifest = readManifest()
    const files = readdirSync(EXAMPLES_DIR).filter((name) => name.endsWith('.flow.json'))

    expect(manifest.map((entry) => entry.file).sort()).toEqual(files.sort())
    expect(new Set(manifest.map((entry) => entry.name)).size).toBe(manifest.length)
    for (const entry of manifest) {
      expect(entry.name).toMatch(/^[a-z0-9-]+$/)
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.description.length).toBeGreaterThan(0)
    }
  })

  it('every example is a version-1 document whose components mirror the graph', () => {
    for (const entry of readManifest()) {
      const doc = readExample(entry.file)
      expect(doc.version).toBe(1)
      expect(doc.title.length).toBeGreaterThan(0)

      const nodeIds = new Set(doc.graph.nodes.map((node) => node.id as string))
      const startNodes = doc.graph.nodes.filter((node) => node.id === 'start')
      expect(startNodes).toHaveLength(1)
      expect(startNodes[0].type).toBe('startNode')

      for (const edge of doc.graph.edges) {
        expect(nodeIds.has(edge.source as string)).toBe(true)
        expect(nodeIds.has(edge.target as string)).toBe(true)
      }

      for (const node of doc.graph.nodes) {
        const data = node.data as { label: string }
        const component = doc.components[node.id as string]
        if (data.label === 'note') {
          expect(component).toBeUndefined()
          continue
        }
        expect(component).toBeDefined()
        const expectedUpstream = [
          ...new Set(doc.graph.edges.filter((e) => e.target === node.id).map((e) => e.source as string))
        ]
        const expectedDownstream = [
          ...new Set(doc.graph.edges.filter((e) => e.source === node.id).map((e) => e.target as string))
        ]
        expect(component.upstream).toEqual(expectedUpstream)
        expect(component.downstream).toEqual(expectedDownstream)
        expect(component.parent_id).toBe(node.parentId)
      }
    }
  })

  it('container children point at a real container and edges never cross a container boundary', () => {
    for (const entry of readManifest()) {
      const doc = readExample(entry.file)
      const containers = new Set(
        doc.graph.nodes.filter((node) => node.type === 'containerNode').map((node) => node.id as string)
      )
      for (const node of doc.graph.nodes) {
        if (typeof node.parentId !== 'string') {
          continue
        }
        expect(containers.has(node.parentId)).toBe(true)
        // 画布只用 parentId + 相对坐标管理归属（允许拖出容器），不设 extent。
        expect(node.extent).toBeUndefined()
      }
      for (const edge of doc.graph.edges) {
        const source = doc.graph.nodes.find((node) => node.id === edge.source)
        const target = doc.graph.nodes.find((node) => node.id === edge.target)
        expect(source?.parentId).toBe(target?.parentId)
      }
    }
  })
})
