import { describe, expect, it } from 'vitest'
import type { FlowNode } from '@/core/types'
import {
  dropLeavesContainer,
  findNoteAtPoint,
  isIgnoredConnectTarget,
  isSourceOrAncestor,
  mergeNodeMetrics,
  pickDropTargetNode,
  pointHitsNode
} from '../drop-target'

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

  it('finds a note under the pointer even when pickDropTargetNode skips it', () => {
    expect(findNoteAtPoint({ x: 160, y: 110 }, [note])?.id).toBe('note')
    expect(findNoteAtPoint({ x: 10, y: 10 }, [note])).toBeNull()
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
    expect(pickDropTargetNode({ x: 80, y: 90 }, [box, child], 'loop')?.id).toBe('child')
  })

  it('hits a child when the drop is on the protruding left target handle', () => {
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
    // 入口在节点左缘外侧；从母容器拉线时 RF 常把 toNode 报成容器本身。
    expect(pickDropTargetNode({ x: 32, y: 100 }, [box, child], 'loop')?.id).toBe('child')
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

    it('does not let the pad steal a sibling across empty body', () => {
      const above = node('above', {
        parentId: 'loop',
        position: { x: 40, y: 60 },
        width: 240,
        height: 80
      })
      const stacked = node('stacked', {
        parentId: 'loop',
        position: { x: 40, y: 180 },
        width: 240,
        height: 80
      })
      // above 底边 y=140；36px 全向垫片会吞掉缝里的 (160,155)，左侧垫片不应命中。
      expect(pickDropTargetNode({ x: 160, y: 155 }, [box, loopStart, above, stacked, outside], 'stacked')).toBeNull()
    })

    it('does not let the pad steal an outside node from the source container body', () => {
      const near = node('near', { position: { x: 420, y: 40 }, width: 240, height: 80 })
      expect(pickDropTargetNode({ x: 390, y: 80 }, [box, loopStart, near], 'loop')).toBeNull()
    })

    it('does not treat loop-start as a connect target', () => {
      expect(isIgnoredConnectTarget(loopStart)).toBe(true)
      expect(pickDropTargetNode({ x: 30, y: 60 }, [box, loopStart, sibling, outside], 'sibling')).toBeNull()
      expect(pickDropTargetNode({ x: 30, y: 60 }, [box, loopStart, sibling, outside], 'outside')?.id).toBe('loop')
    })
  })
})

describe('pointHitsNode', () => {
  it('detects the source body so a click-release can cancel', () => {
    const task = node('task', { position: { x: 100, y: 80 }, width: 240, height: 80 })
    expect(pointHitsNode({ x: 160, y: 110 }, [task], 'task')).toBe(true)
    expect(pointHitsNode({ x: 10, y: 10 }, [task], 'task')).toBe(false)
    expect(pointHitsNode({ x: 160, y: 110 }, [task], 'missing')).toBe(false)
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
