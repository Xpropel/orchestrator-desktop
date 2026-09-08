import { describe, expect, it } from 'vitest'
import type { FlowNode } from '@/core/types'
import { dropLeavesContainer, isSourceOrAncestor, mergeNodeMetrics, pickDropTargetNode } from '../drop-target'

function node(id: string, extras?: Partial<FlowNode>): FlowNode {
  return {
    id,
    type: extras?.type ?? 'taskNode',
    position: extras?.position ?? { x: 0, y: 0 },
    data: extras?.data ?? { label: 'agent', name: id, form: {} },
    ...extras
  }
}

describe('pickDropTargetNode', () => {
  const task = node('task', { position: { x: 100, y: 80 }, width: 240, height: 80 })
  const note = node('note', {
    type: 'noteNode',
    position: { x: 100, y: 80 },
    width: 240,
    height: 80,
    data: { label: 'note', name: 'note', form: {} }
  })

  it('returns null when the point misses every node', () => {
    expect(pickDropTargetNode({ x: 10, y: 10 }, [task])).toBeNull()
  })

  it('hits a node body', () => {
    expect(pickDropTargetNode({ x: 160, y: 110 }, [task])?.id).toBe('task')
  })

  it('skips notes', () => {
    expect(pickDropTargetNode({ x: 160, y: 110 }, [note])).toBeNull()
  })

  it('prefers a container child over the container', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const child = node('child', {
      parentId: 'loop',
      position: { x: 40, y: 60 },
      width: 240,
      height: 80
    })
    expect(pickDropTargetNode({ x: 80, y: 90 }, [box, child])?.id).toBe('child')
  })

  it('prefers the later sibling when two top-level boxes overlap', () => {
    const back = node('back', { position: { x: 0, y: 0 }, width: 200, height: 120 })
    const front = node('front', { position: { x: 40, y: 20 }, width: 200, height: 120 })
    expect(pickDropTargetNode({ x: 80, y: 40 }, [back, front])?.id).toBe('front')
  })

  describe('dragging out of a loop body', () => {
    const box = node('loop', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { label: 'foreach', name: 'loop', form: {} }
    })
    const loopStart = node('loop:start', {
      type: 'loopStartNode',
      parentId: 'loop',
      position: { x: 24, y: 56 },
      width: 40,
      height: 40,
      data: { label: 'loop-start', name: 'LoopStart_1', form: {} }
    })
    const sibling = node('sibling', { parentId: 'loop', position: { x: 200, y: 60 }, width: 240, height: 80 })
    const outside = node('outside', { position: { x: 500, y: 40 }, width: 240, height: 80 })

    it('treats the enclosing container body as empty space', () => {
      expect(pickDropTargetNode({ x: 120, y: 200 }, [box, loopStart, sibling, outside], 'loop:start')).toBeNull()
    })

    it('still hits siblings inside and nodes outside the container', () => {
      expect(pickDropTargetNode({ x: 260, y: 90 }, [box, loopStart, sibling, outside], 'loop:start')?.id).toBe(
        'sibling'
      )
      expect(pickDropTargetNode({ x: 560, y: 60 }, [box, loopStart, sibling, outside], 'loop:start')?.id).toBe(
        'outside'
      )
    })

    it('lets an outside source still target the container body', () => {
      expect(pickDropTargetNode({ x: 120, y: 200 }, [box, loopStart, sibling, outside], 'outside')?.id).toBe('loop')
    })

    it('never returns the source itself', () => {
      expect(pickDropTargetNode({ x: 30, y: 60 }, [box, loopStart, sibling, outside], 'loop:start')).toBeNull()
    })
  })
})

describe('dropLeavesContainer', () => {
  const box = node('loop', {
    type: 'containerNode',
    position: { x: 100, y: 100 },
    width: 400,
    height: 300,
    data: { label: 'foreach', name: 'loop', form: {} }
  })
  const inner = node('inner', { parentId: 'loop', position: { x: 40, y: 60 }, width: 240, height: 80 })
  const outside = node('outside', { position: { x: 700, y: 100 } })

  it('flags a drop outside the source container', () => {
    expect(dropLeavesContainer({ x: 600, y: 200 }, [box, inner, outside], 'inner')).toBe(true)
    expect(dropLeavesContainer({ x: 200, y: 450 }, [box, inner, outside], 'inner')).toBe(true)
  })

  it('accepts a drop inside the container and ignores top-level sources', () => {
    expect(dropLeavesContainer({ x: 300, y: 300 }, [box, inner, outside], 'inner')).toBe(false)
    expect(dropLeavesContainer({ x: 1000, y: 1000 }, [box, inner, outside], 'outside')).toBe(false)
  })
})

describe('isSourceOrAncestor', () => {
  const box = node('loop', { type: 'containerNode', data: { label: 'foreach', name: 'loop', form: {} } })
  const inner = node('inner', { parentId: 'loop' })
  const other = node('other')

  it('covers the source and every container above it', () => {
    expect(isSourceOrAncestor([box, inner, other], 'inner', 'inner')).toBe(true)
    expect(isSourceOrAncestor([box, inner, other], 'inner', 'loop')).toBe(true)
    expect(isSourceOrAncestor([box, inner, other], 'inner', 'other')).toBe(false)
  })
})

describe('mergeNodeMetrics', () => {
  it('overlays measured size from the canvas snapshot', () => {
    const store = [node('a', { position: { x: 1, y: 2 } })]
    const measured = [node('a', { position: { x: 9, y: 8 }, measured: { width: 140, height: 44 } })]
    expect(mergeNodeMetrics(store, measured)[0]).toMatchObject({
      position: { x: 9, y: 8 },
      measured: { width: 140, height: 44 }
    })
  })
})
