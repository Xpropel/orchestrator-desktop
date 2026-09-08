import { beforeAll, describe, expect, it } from 'vitest'
import { loadLibrary } from '../../library'
import type { FlowEdge, FlowNode } from '../../types'
import {
  CONTAINER_DEFAULT_HEIGHT,
  CONTAINER_DEFAULT_WIDTH,
  CONTAINER_MIN_HEIGHT,
  CONTAINER_MIN_WIDTH,
  clampPositionInsideParent,
  collectDanglingEdgeIds,
  collectDescendantIds,
  createOperatorNode,
  explainInvalidConnection,
  getNodeAbsoluteBox,
  getNodeBoxSize,
  isValidFlowConnection,
  minContainerSizeForChildren,
  nextNodeName,
  onlyInsideContainerToast,
  planClampChildInParent,
  planKeepInsideContainer,
  resolveParentAfterDrag,
  stripRuntimeNode
} from '../index'

beforeAll(() => {
  loadLibrary()
})

function node(id: string, label: string, extras?: Partial<FlowNode>): FlowNode {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { label, name: id, form: {} },
    ...extras
  }
}

function edge(id: string, source: string, target: string, sourceHandle: string | null = 'start'): FlowEdge {
  return { id, source, target, sourceHandle }
}

describe('collectDanglingEdgeIds physical start ports', () => {
  it('treats start#rank as the logical start outlet and does not prune it', () => {
    const nodes = [node('a', 'agent', { type: 'taskNode' }), node('b', 'message', { type: 'taskNode' })]
    expect(collectDanglingEdgeIds(nodes, [edge('ok', 'a', 'b', 'start#1')])).toEqual([])
    expect(collectDanglingEdgeIds(nodes, [edge('ok', 'a', 'b', 'start#new')])).toEqual([])
    expect(collectDanglingEdgeIds(nodes, [edge('ok', 'a', 'b', 'start')])).toEqual([])
  })
})

describe('nextNodeName uniqueness', () => {
  it('skips a name already used by a different operator', () => {
    const nodes = [node('m', 'message', { data: { label: 'message', name: 'agent_1', form: {} } })]
    expect(nextNodeName(nodes, 'agent')).toBe('agent_2')
  })

  it('ignores non-numeric suffixes such as agent_2foo', () => {
    const nodes = [node('a', 'agent', { data: { label: 'agent', name: 'agent_2foo', form: {} } })]
    expect(nextNodeName(nodes, 'agent')).toBe('agent_1')
  })
})

describe('getNodeBoxSize / getNodeAbsoluteBox fallbacks', () => {
  it('uses style.width/height when measured and width/height are missing (fresh note)', () => {
    const note = node('n', 'note', {
      type: 'noteNode',
      style: { width: 200, height: 140 }
    })
    expect(getNodeBoxSize(note)).toEqual({ width: 200, height: 140 })
    expect(getNodeAbsoluteBox(note, [note])).toMatchObject({ x: 0, y: 0, width: 200, height: 140 })
  })

  it('parses style sizes written as px strings', () => {
    const card = node('a', 'agent', { type: 'taskNode', style: { width: '260px', height: '96px' } })
    expect(getNodeBoxSize(card)).toEqual({ width: 260, height: 96 })
  })

  it('estimates start/note/container when nothing is measured (resized-then-undone)', () => {
    expect(getNodeBoxSize(node('s', 'start', { type: 'startNode' }))).toEqual({ width: 140, height: 44 })
    expect(getNodeBoxSize(node('n', 'note', { type: 'noteNode' }))).toEqual({ width: 200, height: 140 })
    expect(getNodeBoxSize(node('loop', 'foreach', { type: 'containerNode' }))).toEqual({
      width: CONTAINER_DEFAULT_WIDTH,
      height: CONTAINER_DEFAULT_HEIGHT
    })
  })
})

describe('collectDescendantIds cycles', () => {
  it('does not loop when parentId forms a cycle', () => {
    const a = node('a', 'agent', { parentId: 'b' })
    const b = node('b', 'agent', { parentId: 'a' })
    expect(collectDescendantIds([a, b], 'a').sort()).toEqual(['b'])
    expect(collectDescendantIds([a, b], 'b').sort()).toEqual(['a'])
  })
})

describe('minContainerSizeForChildren', () => {
  it('stays at the container floor when empty', () => {
    expect(minContainerSizeForChildren('loop', [node('loop', 'foreach', { type: 'containerNode' })])).toEqual({
      width: CONTAINER_MIN_WIDTH,
      height: CONTAINER_MIN_HEIGHT
    })
  })

  it('grows to fit a child that sits past the default box', () => {
    const loop = node('loop', 'foreach', { type: 'containerNode' })
    const child = node('c', 'agent', {
      type: 'taskNode',
      parentId: 'loop',
      position: { x: 400, y: 200 },
      width: 240,
      height: 80
    })
    const size = minContainerSizeForChildren('loop', [loop, child])
    expect(size.width).toBeGreaterThanOrEqual(400 + 240 + 28)
    expect(size.height).toBeGreaterThanOrEqual(200 + 80 + 16)
  })
})

describe('stripRuntimeNode size round-trip', () => {
  it('keeps task-node width/height and mirrors them onto style like containers', () => {
    const task = node('a', 'agent', {
      type: 'taskNode',
      width: 300,
      height: 120,
      selected: true,
      measured: { width: 300, height: 120 }
    })
    const stripped = stripRuntimeNode(task)
    expect(stripped.width).toBe(300)
    expect(stripped.height).toBe(120)
    expect(stripped.measured).toBeUndefined()
    expect(stripped.selected).toBeUndefined()
    expect(stripped.style).toMatchObject({ width: 300, height: 120 })
  })
})

describe('loop-start is not a connection target', () => {
  function connection(
    source: string,
    target: string,
    sourceHandle: string | null = 'start'
  ): { source: string; target: string; sourceHandle: string | null; targetHandle: string } {
    return { source, target, sourceHandle, targetHandle: 'end' }
  }

  it('rejects a sibling dropping onto loop-start the same way as start', () => {
    const nodes = [
      node('loop', 'foreach', { type: 'containerNode' }),
      node('loop:start', 'loop-start', { type: 'loopStartNode', parentId: 'loop' }),
      node('inner', 'agent', { type: 'taskNode', parentId: 'loop' }),
      node('start', 'start', { type: 'startNode' })
    ]
    expect(explainInvalidConnection(nodes, [], connection('inner', 'loop:start'))).toBe(
      '不能连接：不能连到开始节点'
    )
    expect(isValidFlowConnection(nodes, [], connection('inner', 'loop:start'))).toBe(false)
    expect(explainInvalidConnection(nodes, [], connection('inner', 'start'))).toBe(
      '不能连接：不能连到开始节点'
    )
  })
})

describe('onlyInsideContainer drag (break)', () => {
  const box = node('loop', 'foreach', {
    type: 'containerNode',
    position: { x: 0, y: 0 },
    width: 400,
    height: 300
  })
  const other = node('loop2', 'foreach', {
    type: 'containerNode',
    position: { x: 500, y: 0 },
    width: 400,
    height: 300
  })

  it('does not detach break when the drop leaves every container', () => {
    const brk = node('brk', 'break', {
      type: 'breakNode',
      parentId: 'loop',
      position: { x: 300, y: 220 },
      width: 88,
      height: 44
    })
    expect(resolveParentAfterDrag(brk, [box, brk], { x: 900, y: 900 })).toBeNull()
  })

  it('still re-parents break into a different container', () => {
    const brk = node('brk', 'break', {
      type: 'breakNode',
      parentId: 'loop',
      position: { x: 40, y: 60 },
      width: 88,
      height: 44
    })
    const change = resolveParentAfterDrag(brk, [box, other, brk], { x: 600, y: 100 })
    expect(change?.parentId).toBe('loop2')
  })

  it('clamps an escaped break back into the current parent and names the toast from the operator title', () => {
    const brk = node('brk', 'break', {
      type: 'breakNode',
      parentId: 'loop',
      position: { x: 520, y: 410 },
      width: 88,
      height: 44
    })
    expect(clampPositionInsideParent(brk, box)).toEqual({ x: 284, y: 256 })
    const keep = planKeepInsideContainer(brk, [box, brk])
    expect(keep).toEqual({
      parentId: 'loop',
      position: { x: 284, y: 256 },
      toast: onlyInsideContainerToast(brk)
    })
    expect(keep?.toast).toBe('Break 只能放在循环容器内')
  })

  it('does not toast when break is already inside the parent box', () => {
    const brk = node('brk', 'break', {
      type: 'breakNode',
      parentId: 'loop',
      position: { x: 40, y: 60 },
      width: 88,
      height: 44
    })
    expect(planKeepInsideContainer(brk, [box, brk])).toBeNull()
  })
})

describe('planClampChildInParent', () => {
  const box = node('loop', 'foreach', {
    type: 'containerNode',
    position: { x: 0, y: 0 },
    width: 400,
    height: 300
  })

  it('pulls a child off the container source ports', () => {
    const inner = node('inner', 'agent', {
      type: 'taskNode',
      parentId: 'loop',
      position: { x: 200, y: 80 },
      width: 240,
      height: 80
    })
    expect(planClampChildInParent(inner, [box, inner])).toEqual({
      parentId: 'loop',
      position: { x: 132, y: 80 }
    })
  })

  it('leaves a child that already clears the port gutter', () => {
    const inner = node('inner', 'agent', {
      type: 'taskNode',
      parentId: 'loop',
      position: { x: 40, y: 80 },
      width: 240,
      height: 80
    })
    expect(planClampChildInParent(inner, [box, inner])).toBeNull()
  })
})

describe('createOperatorNode note size', () => {
  it('writes width/height as well as style so geometry does not wait for measure', () => {
    const created = createOperatorNode('note', { x: 0, y: 0 }, [])
    expect(created.width).toBe(200)
    expect(created.height).toBe(140)
    expect(created.style).toMatchObject({ width: 200, height: 140 })
    expect(getNodeBoxSize(created)).toEqual({ width: 200, height: 140 })
  })
})
