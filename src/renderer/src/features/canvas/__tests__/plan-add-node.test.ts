import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createOperatorNode, createStartNode } from '@/core/graph'
import { loadLibrary } from '@/core/library'
import { planAddAtFlowPosition, planAddAtViewportCenter } from '../plan-add-node'

beforeAll(() => {
  loadLibrary()
})

describe('planAddAtFlowPosition', () => {
  const start = createStartNode()

  it('rejects loop-start and unknown types, but allows another start', () => {
    const added = planAddAtFlowPosition('start', { x: 10, y: 10 }, [start])
    expect(added.ok).toBe(true)
    if (added.ok) {
      expect(added.node.id).toMatch(/^start:[\w-]{8}$/)
      expect(added.node.data.name).toBe('start_1')
      expect(added.node.parentId).toBeUndefined()
    }
    expect(planAddAtFlowPosition('loop-start', { x: 10, y: 10 }, [start]).ok).toBe(false)
    expect(planAddAtFlowPosition('no-such-op', { x: 10, y: 10 }, [start]).ok).toBe(false)
  })

  it('does not parent a start dropped onto a container', () => {
    const box = createOperatorNode('foreach', { x: 0, y: 0 }, [start])
    const result = planAddAtFlowPosition('start', { x: 80, y: 80 }, [start, box])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.node.parentId).toBeUndefined()
    expect(result.node.data.name).toBe('start_1')
  })

  it('parents a task dropped inside a container', () => {
    const box = createOperatorNode('foreach', { x: 0, y: 0 }, [start])
    const result = planAddAtFlowPosition('agent', { x: 80, y: 80 }, [start, box])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.node.parentId).toBe(box.id)
    expect(result.node.data.label).toBe('agent')
  })

  it('rejects break outside a container and allows it inside', () => {
    const outside = planAddAtFlowPosition('break', { x: 800, y: 800 }, [start])
    expect(outside).toEqual({ ok: false, toast: 'break 只能放在循环容器内' })
    const box = createOperatorNode('foreach', { x: 0, y: 0 }, [start])
    const inside = planAddAtFlowPosition('break', { x: 80, y: 80 }, [start, box])
    expect(inside.ok).toBe(true)
    if (!inside.ok) return
    expect(inside.node.parentId).toBe(box.id)
  })

  it('honors an explicit null parentId even when the point sits inside a container', () => {
    const box = createOperatorNode('foreach', { x: 0, y: 0 }, [start])
    const result = planAddAtFlowPosition('agent', { x: 80, y: 80 }, [start, box], { parentId: null })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.node.parentId).toBeUndefined()
  })

  it('uses an explicit parentId without re-inferring a different container', () => {
    const box = createOperatorNode('foreach', { x: 0, y: 0 }, [start])
    const result = planAddAtFlowPosition('agent', { x: 80, y: 80 }, [start, box], { parentId: box.id })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.node.parentId).toBe(box.id)
  })
})

describe('planAddAtViewportCenter', () => {
  beforeEach(() => {
    /* viewport math only */
  })

  it('places a node near the viewport center without overlapping start', () => {
    const start = createStartNode()
    const result = planAddAtViewportCenter(
      'message',
      [start],
      { x: 0, y: 0, zoom: 1 },
      { width: 800, height: 600 }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.node.parentId).toBeUndefined()
    expect(result.node.position.x).not.toBe(start.position.x)
  })

  it('places a second start near the viewport center', () => {
    const start = createStartNode()
    const result = planAddAtViewportCenter('start', [start], { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.node.id).toMatch(/^start:[\w-]{8}$/)
    expect(result.node.data.name).toBe('start_1')
  })
})
