import { describe, expect, it } from 'vitest'
import type { FlowNode } from '@/core/types'
import { mergeNodeMetrics, pickDropTargetNode } from '../drop-target'

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
