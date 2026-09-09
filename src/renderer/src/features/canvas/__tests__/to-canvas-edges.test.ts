import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { HANDLE_START, isLogicalStartHandle, logicalHandleId } from '@/core/handles'
import { loadLibrary } from '@/core/library'
import type { FlowEdge, FlowNode } from '@/core/types'
import { toCanvasEdges, toCanvasNodes } from '../flow-types'

beforeAll(() => {
  loadLibrary()
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

function edge(id: string, source: string, target: string, sourceHandle: string | null = 'start'): FlowEdge {
  return { id, source, target, sourceHandle, targetHandle: 'end' }
}

describe('toCanvasEdges', () => {
  it('rewrites start edges to start#rank in array order and leaves branch handles', () => {
    const edges: FlowEdge[] = [
      edge('a', 'src', 't1'),
      edge('b', 'branch', 't2', 'case-a'),
      edge('c', 'src', 't3'),
      edge('d', 'other', 't4'),
      edge('e', 'src', 't5')
    ]
    const canvas = toCanvasEdges(edges)
    expect(canvas.map((item) => item.sourceHandle)).toEqual(['start#1', 'case-a', 'start#2', 'start#1', 'start#3'])
    expect(edges[0]?.sourceHandle).toBe(HANDLE_START)
  })

  it('renumbers after a middle edge is removed', () => {
    const edges = [edge('a', 'src', 't1'), edge('b', 'src', 't2'), edge('c', 'src', 't3')]
    expect(toCanvasEdges(edges.filter((item) => item.id !== 'b')).map((item) => item.sourceHandle)).toEqual([
      'start#1',
      'start#2'
    ])
  })

  it('maps every example start edge onto a unique start#rank per source', () => {
    const files = listExampleFlowFiles()
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const doc = JSON.parse(readFileSync(file, 'utf8')) as {
        graph: { edges: FlowEdge[] }
      }
      const canvas = toCanvasEdges(doc.graph.edges)
      const seen = new Map<string, Set<string>>()
      for (let index = 0; index < doc.graph.edges.length; index += 1) {
        const raw = doc.graph.edges[index]
        const next = canvas[index]
        expect(raw).toBeDefined()
        expect(next).toBeDefined()
        if (!raw || !next) continue
        if (!isLogicalStartHandle(raw.sourceHandle)) {
          expect(next.sourceHandle).toBe(raw.sourceHandle)
          continue
        }
        expect(logicalHandleId(next.sourceHandle)).toBe(HANDLE_START)
        expect(next.sourceHandle).toMatch(/^start#\d+$/)
        const group = seen.get(raw.source) ?? new Set<string>()
        expect(group.has(next.sourceHandle ?? '')).toBe(false)
        group.add(next.sourceHandle ?? '')
        seen.set(raw.source, group)
      }
    }
  })
})

describe('toCanvasNodes', () => {
  it('keeps parents ahead of children so React Flow can attach the group after reload', () => {
    const inner = {
      id: 'inner',
      type: 'taskNode',
      position: { x: 40, y: 80 },
      parentId: 'loop',
      data: { label: 'agent', name: 'inner', form: {} }
    } as FlowNode
    const box = {
      id: 'loop',
      type: 'containerNode',
      position: { x: 0, y: 0 },
      data: { label: 'foreach', name: 'loop', form: {} }
    } as FlowNode
    expect(toCanvasNodes([inner, box]).map((item) => item.id)).toEqual(['loop', 'inner'])
  })
})
