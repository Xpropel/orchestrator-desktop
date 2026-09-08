import { beforeAll, describe, expect, it } from 'vitest'
import { loadLibrary } from '../../library'
import { getSourceHandles } from '../../registry'
import type { FlowConnection, FlowEdge, FlowNode } from '../../types'
import {
  CONTAINER_DEFAULT_HEIGHT,
  CONTAINER_DEFAULT_WIDTH,
  canAddOperator,
  collectDanglingEdgeIds,
  collectDescendantIds,
  createOperatorNode,
  createStartNode,
  downstreamRows,
  expandCopyIds,
  extractSubgraph,
  findContainingContainer,
  findIntersectingContainer,
  findNonOverlappingPosition,
  idsProtectedFromRemoval,
  isProtectedNode,
  resolveParentAfterDrag,
  flowCenterFromViewport,
  explainInvalidConnection,
  hasMatchingConnection,
  isValidFlowConnection,
  nextNodeName,
  normalizeFlowConnection,
  reorderOutgoingEdges,
  overlapRatio,
  remapClipboard,
  toAbsolutePosition,
  toRelativePosition,
  wouldCreateCycle
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

function connection(source: string, target: string, sourceHandle: string | null = 'start'): FlowConnection {
  return { source, target, sourceHandle, targetHandle: 'end' }
}

describe('nextNodeName', () => {
  it('starts at 1 when no siblings exist', () => {
    expect(nextNodeName([], 'agent')).toBe('agent_1')
  })

  it('increments from the highest existing suffix', () => {
    const nodes = [node('a', 'agent', { data: { label: 'agent', name: 'agent_2', form: {} } })]
    expect(nextNodeName(nodes, 'agent')).toBe('agent_3')
  })

  it('ignores other operator names', () => {
    const nodes = [node('r', 'retrieval', { data: { label: 'retrieval', name: 'retrieval_9', form: {} } })]
    expect(nextNodeName(nodes, 'agent')).toBe('agent_1')
  })
})

describe('wouldCreateCycle', () => {
  const nodes = [node('a', 'agent'), node('b', 'message'), node('c', 'code')]

  it('treats a self-link as a cycle', () => {
    expect(wouldCreateCycle(nodes, [], connection('a', 'a'))).toBe(true)
  })

  it('detects a cycle through an existing path', () => {
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')]
    expect(wouldCreateCycle(nodes, edges, connection('c', 'a'))).toBe(true)
  })

  it('allows a forward edge in a DAG', () => {
    const edges = [edge('e1', 'a', 'b')]
    expect(wouldCreateCycle(nodes, edges, connection('b', 'c'))).toBe(false)
  })

  it('detects a cycle among container children', () => {
    const inner = [
      node('a', 'agent', { parentId: 'loop' }),
      node('b', 'message', { parentId: 'loop' })
    ]
    expect(wouldCreateCycle(inner, [edge('e1', 'a', 'b')], connection('b', 'a'))).toBe(true)
  })
})

describe('isValidFlowConnection', () => {
  const nodes = [
    node('start', 'start', { type: 'startNode' }),
    node('a', 'agent', { type: 'taskNode' }),
    node('b', 'message', { type: 'taskNode' }),
    node('end', 'end', { type: 'endNode' }),
    node('note', 'note', { type: 'noteNode' }),
    node('brk', 'break', { type: 'breakNode', parentId: 'loop' })
  ]

  it('rejects self links, notes, start-as-target, end/break-as-source, duplicates, and cycles', () => {
    expect(isValidFlowConnection(nodes, [], connection('a', 'a'))).toBe(false)
    expect(isValidFlowConnection(nodes, [], connection('a', 'note'))).toBe(false)
    expect(isValidFlowConnection(nodes, [], connection('note', 'a'))).toBe(false)
    expect(isValidFlowConnection(nodes, [], connection('a', 'start'))).toBe(false)
    expect(isValidFlowConnection(nodes, [], connection('end', 'a'))).toBe(false)
    expect(isValidFlowConnection(nodes, [], connection('brk', 'a'))).toBe(false)
    expect(isValidFlowConnection(nodes, [edge('e1', 'a', 'b')], connection('a', 'b'))).toBe(false)
    expect(isValidFlowConnection(nodes, [edge('e1', 'a', 'b')], connection('b', 'a'))).toBe(false)
  })

  it('accepts a new legal edge and allows in/out of a container', () => {
    expect(isValidFlowConnection(nodes, [], connection('a', 'b'))).toBe(true)
    const boxed = [
      ...nodes,
      node('inside', 'agent', { id: 'inside', type: 'taskNode', parentId: 'loop' })
    ]
    expect(isValidFlowConnection(boxed, [], connection('a', 'inside'))).toBe(true)
    expect(isValidFlowConnection(boxed, [], connection('inside', 'b'))).toBe(true)
  })

  it('treats physical start ports as the logical start handle', () => {
    expect(isValidFlowConnection(nodes, [], connection('a', 'b', 'start#new'))).toBe(true)
    expect(isValidFlowConnection(nodes, [edge('e1', 'a', 'b')], connection('a', 'b', 'start#1'))).toBe(false)
    expect(explainInvalidConnection(nodes, [edge('e1', 'a', 'b')], connection('b', 'a', 'start#new'))).toBe(
      '不能连接：会形成环'
    )
  })
})

describe('hasMatchingConnection', () => {
  it('matches a stored start edge against start#new and ignores a hover without a stored edge', () => {
    expect(
      hasMatchingConnection([edge('e1', 'a', 'b')], { source: 'a', target: 'b', sourceHandle: 'start#new' })
    ).toBe(true)
    expect(hasMatchingConnection([], { source: 'a', target: 'b', sourceHandle: 'start' })).toBe(false)
    expect(
      hasMatchingConnection([edge('e1', 'a', 'b')], { source: 'a', target: null, sourceHandle: 'start' })
    ).toBe(false)
  })
})

describe('normalizeFlowConnection', () => {
  const nodes = [node('a', 'agent', { type: 'taskNode' }), node('b', 'message', { type: 'taskNode' })]

  it('strips physical ids and repairs a source handle used as target', () => {
    expect(
      normalizeFlowConnection(nodes, {
        source: 'a',
        target: 'b',
        sourceHandle: 'start#new',
        targetHandle: 'start#1'
      })
    ).toEqual({
      source: 'a',
      target: 'b',
      sourceHandle: 'start',
      targetHandle: 'end'
    })
  })
})

describe('reorderOutgoingEdges', () => {
  it('reorders one start group and leaves other edges in place', () => {
    const edges = [
      edge('x', 'other', 'z'),
      edge('e1', 'src', 'a'),
      edge('y', 'mid', 'z'),
      edge('e2', 'src', 'b'),
      edge('e3', 'src', 'c')
    ]
    const next = reorderOutgoingEdges(edges, 'e3', 0)
    expect(next.map((item) => item.id)).toEqual(['x', 'e3', 'y', 'e1', 'e2'])
  })
})

describe('downstreamRows', () => {
  const nodes = [
    node('ds', 'dataset', { data: { label: 'dataset', name: '母数据集', form: {} } }),
    node('a', 'dataset', { data: { label: 'dataset', name: '子集 A', form: {} } }),
    node('b', 'dataset', { data: { label: 'dataset', name: '子集 B', form: {} } })
  ]

  it('lists a dataset fan-out in edge order with target names', () => {
    const edges = [edge('e1', 'ds', 'a'), edge('e2', 'ds', 'b'), edge('e3', 'ds', 'missing')]
    expect(downstreamRows(edges, nodes, 'ds')).toEqual([
      { edgeId: 'e1', index: 0, name: '子集 A' },
      { edgeId: 'e2', index: 1, name: '子集 B' },
      { edgeId: 'e3', index: 2, name: 'missing' }
    ])
  })

  it('is empty below two start edges and ignores branch handles', () => {
    expect(downstreamRows([edge('e1', 'ds', 'a')], nodes, 'ds')).toEqual([])
    expect(downstreamRows([edge('e1', 'ds', 'a', 'true'), edge('e2', 'ds', 'b', 'false')], nodes, 'ds')).toEqual(
      []
    )
  })
})

describe('handles and dangling edges', () => {
  it('returns case ids plus else for switch', () => {
    const switchNode = node('s', 'switch', {
      type: 'branchNode',
      data: {
        label: 'switch',
        name: 'switch_1',
        form: { cases: [{ id: 'case-a', label: 'A', expression: '' }] }
      }
    })
    expect(getSourceHandles(switchNode.data.label, switchNode.data.form).map((handle) => handle.id)).toEqual([
      'case-a',
      'else'
    ])
  })

  it('prunes edges whose sourceHandle no longer exists', () => {
    const switchNode = node('s', 'switch', {
      type: 'branchNode',
      data: {
        label: 'switch',
        name: 'switch_1',
        form: { cases: [{ id: 'keep', label: 'Keep', expression: '' }] }
      }
    })
    const target = node('t', 'message', { type: 'taskNode' })
    const edges = [
      edge('ok', 's', 't', 'keep'),
      edge('else-ok', 's', 't', 'else'),
      edge('gone', 's', 't', 'deleted-case')
    ]
    expect(collectDanglingEdgeIds([switchNode, target], edges)).toEqual(['gone'])
  })
})

describe('container geometry and descendants', () => {
  const container = node('loop', 'foreach', {
    type: 'containerNode',
    position: { x: 100, y: 80 },
    width: 420,
    height: 280
  })
  const child = node('child', 'agent', {
    type: 'taskNode',
    parentId: 'loop',
    position: { x: 24, y: 56 }
  })
  const grandchild = node('g', 'message', {
    type: 'taskNode',
    parentId: 'child',
    position: { x: 10, y: 10 }
  })

  it('collects the parentId descendant chain', () => {
    expect(collectDescendantIds([container, child, grandchild], 'loop').sort()).toEqual(['child', 'g'])
  })

  it('converts absolute and relative coordinates', () => {
    const nodes = [container, child]
    expect(toAbsolutePosition(child.position, container, nodes)).toEqual({ x: 124, y: 136 })
    expect(toRelativePosition({ x: 124, y: 136 }, container, nodes)).toEqual({ x: 24, y: 56 })
  })

  it('finds the container that contains a point', () => {
    expect(findContainingContainer({ x: 200, y: 160 }, [container, child])?.id).toBe('loop')
    expect(findContainingContainer({ x: 10, y: 10 }, [container, child])).toBeNull()
  })

  it('computes the overlap ratio of a node box against a container box', () => {
    const box = { x: 0, y: 0, width: 100, height: 100 }
    expect(overlapRatio(box, { x: 0, y: 0, width: 100, height: 100 })).toBe(1)
    expect(overlapRatio(box, { x: 50, y: 0, width: 100, height: 100 })).toBe(0.5)
    expect(overlapRatio(box, { x: 100, y: 0, width: 100, height: 100 })).toBe(0)
  })

  it('drop detection prefers the pointer position, then falls back to node overlap', () => {
    // 节点 240×80，中心落在容器外，但指针在容器内 → 命中
    const outside = node('task', 'agent', { type: 'taskNode', position: { x: 400, y: 300 }, width: 240, height: 80 })
    outside.measured = { width: 240, height: 80 }
    const nodes = [container, outside]
    expect(findIntersectingContainer(outside, nodes, { x: 480, y: 320 })?.id).toBe('loop')
    // 指针在容器外、节点几乎完全在外 → 不命中
    expect(findIntersectingContainer(outside, nodes, { x: 900, y: 900 })).toBeNull()
    // 无指针：节点一半以上面积在容器内 → 命中；只有一小角在内 → 不命中
    const halfIn = node('half', 'agent', { type: 'taskNode', position: { x: 400, y: 200 }, width: 240, height: 80 })
    halfIn.measured = { width: 240, height: 80 }
    expect(findIntersectingContainer(halfIn, [container, halfIn])?.id).toBe('loop')
    const cornerIn = node('corner', 'agent', { type: 'taskNode', position: { x: 500, y: 340 }, width: 240, height: 80 })
    cornerIn.measured = { width: 240, height: 80 }
    expect(findIntersectingContainer(cornerIn, [container, cornerIn])).toBeNull()
  })

  it('resolveParentAfterDrag maps pointer hit to setNodeParent args', () => {
    const outside = node('task', 'agent', { type: 'taskNode', position: { x: 400, y: 300 }, width: 240, height: 80 })
    outside.measured = { width: 240, height: 80 }
    const attach = resolveParentAfterDrag(outside, [container, outside], { x: 480, y: 320 })
    expect(attach).toEqual({ parentId: 'loop', position: { x: 300, y: 220 } })
    const already = resolveParentAfterDrag(child, [container, child], { x: 200, y: 160 })
    expect(already).toBeNull()
    const hanging = node('hang', 'agent', {
      type: 'taskNode',
      parentId: 'loop',
      position: { x: 300, y: 220 },
      width: 240,
      height: 80
    })
    hanging.measured = { width: 240, height: 80 }
    const detach = resolveParentAfterDrag(hanging, [container, hanging], { x: 900, y: 900 })
    expect(detach).toEqual({ parentId: null, position: { x: 400, y: 300 } })
    const locked = node('start', 'start', { type: 'startNode', position: { x: 110, y: 90 } })
    expect(resolveParentAfterDrag(locked, [container, locked], { x: 200, y: 160 })).toBeNull()
  })
})

describe('clipboard remap', () => {
  it('copies selected nodes and internal edges, excluding start and expanding containers', () => {
    const nodes = [
      node('start', 'start', { type: 'startNode' }),
      node('loop', 'foreach', { type: 'containerNode' }),
      node('loop:start', 'loop-start', { type: 'loopStartNode', parentId: 'loop' }),
      node('a', 'agent', { type: 'taskNode', parentId: 'loop' })
    ]
    const edges = [edge('e1', 'start', 'loop'), edge('e2', 'loop:start', 'a')]
    expect(expandCopyIds(nodes, ['start', 'loop'])).toEqual(expect.arrayContaining(['loop', 'loop:start', 'a']))
    const clip = extractSubgraph(nodes, edges, ['start', 'loop'])
    expect(clip.nodes.map((item) => item.id).sort()).toEqual(['a', 'loop', 'loop:start'])
    expect(clip.edges.map((item) => item.id)).toEqual(['e2'])
  })

  it('does not copy a loopStart node by itself', () => {
    const nodes = [
      node('loop', 'foreach', { type: 'containerNode' }),
      node('loop:start', 'loop-start', { type: 'loopStartNode', parentId: 'loop' })
    ]
    expect(extractSubgraph(nodes, [], ['loop:start']).nodes).toHaveLength(0)
  })

  it('assigns new ids and remaps parentId for container copies', () => {
    const existing = [node('a', 'agent', { data: { label: 'agent', name: 'agent_1', form: {} } })]
    const payload = {
      nodes: [
        node('old-loop', 'foreach', {
          type: 'containerNode',
          position: { x: 10, y: 20 },
          data: { label: 'foreach', name: 'foreach_1', form: {} }
        }),
        node('old-loop:start', 'loop-start', {
          type: 'loopStartNode',
          parentId: 'old-loop',
          position: { x: 24, y: 56 },
          data: { label: 'loop-start', name: 'loop-start_1', form: {} }
        }),
        node('old-a', 'agent', {
          type: 'taskNode',
          parentId: 'old-loop',
          position: { x: 40, y: 80 },
          data: { label: 'agent', name: 'agent_1', form: {} }
        })
      ],
      edges: [edge('e1', 'old-loop:start', 'old-a')]
    }

    const remapped = remapClipboard(payload, existing, { x: 40, y: 40 })
    expect(remapped.nodes).toHaveLength(3)
    const loop = remapped.nodes.find((item) => item.data.label === 'foreach')
    const start = remapped.nodes.find((item) => item.type === 'loopStartNode')
    const agent = remapped.nodes.find((item) => item.data.label === 'agent')
    expect(loop?.id).not.toBe('old-loop')
    expect(start?.id).toBe(`${loop?.id}:start`)
    expect(start?.parentId).toBe(loop?.id)
    expect(agent?.parentId).toBe(loop?.id)
    expect(loop?.position).toEqual({ x: 50, y: 60 })
    expect(start?.position).toEqual({ x: 24, y: 56 })
    expect(remapped.edges).toHaveLength(1)
    expect(remapped.edges[0].source).toBe(start?.id)
    expect(remapped.edges[0].target).toBe(agent?.id)
  })
})

describe('flowCenterFromViewport', () => {
  it('converts the viewport midpoint back to flow coordinates', () => {
    expect(flowCenterFromViewport({ x: -100, y: -50, zoom: 2 }, 400, 200)).toEqual({
      x: 150,
      y: 75
    })
  })
})

describe('createOperatorNode / findNonOverlappingPosition', () => {
  it('creates agent ids in type:id form', () => {
    const created = createOperatorNode('agent', { x: 0, y: 0 }, [])
    expect(created.id).toMatch(/^agent:[\w-]{8}$/)
    expect(created.type).toBe('taskNode')
  })

  it('creates foreach containers at the default size', () => {
    const created = createOperatorNode('foreach', { x: 0, y: 0 }, [])
    expect(created.type).toBe('containerNode')
    expect(created.width).toBe(CONTAINER_DEFAULT_WIDTH)
    expect(created.height).toBe(CONTAINER_DEFAULT_HEIGHT)
  })

  it('steps right when the preferred box overlaps an existing node', () => {
    const existing = [node('start', 'start', { type: 'startNode', position: { x: 0, y: 0 }, width: 140, height: 44 })]
    existing[0].measured = { width: 140, height: 44 }
    const next = findNonOverlappingPosition({ x: 0, y: 0 }, existing, { width: 240, height: 80 })
    expect(next.x).toBeGreaterThanOrEqual(280)
  })

  it('creates the first start as id/name start, later starts as Type:id + start_N', () => {
    const first = createOperatorNode('start', { x: 0, y: 0 }, [])
    expect(first.id).toBe('start')
    expect(first.data.name).toBe('start')
    const defaultStart = createStartNode()
    const second = createOperatorNode('start', { x: 40, y: 40 }, [defaultStart])
    expect(second.id).toMatch(/^start:[\w-]{8}$/)
    expect(second.data.name).toBe('start_1')
    const third = createOperatorNode('start', { x: 80, y: 80 }, [defaultStart, second])
    expect(third.data.name).toBe('start_2')
    expect(canAddOperator('start', [defaultStart, second])).toBe(true)
    expect(canAddOperator('loop-start', [defaultStart])).toBe(false)
  })
})

describe('isProtectedNode / idsProtectedFromRemoval', () => {
  it('protects loopStart always and the last remaining start', () => {
    const only = createStartNode()
    expect(isProtectedNode(only, [only])).toBe(true)
    const extra = createOperatorNode('start', { x: 10, y: 10 }, [only])
    expect(isProtectedNode(only, [only, extra])).toBe(false)
    expect(isProtectedNode(extra, [only, extra])).toBe(false)
    const loopStart = node('loop:start', 'loop-start', { type: 'loopStartNode', parentId: 'loop' })
    expect(isProtectedNode(loopStart, [only, loopStart])).toBe(true)
    expect([...idsProtectedFromRemoval([only, extra], [only.id, extra.id])]).toEqual(['start'])
    expect([...idsProtectedFromRemoval([only, extra], [extra.id])]).toEqual([])
    expect([...idsProtectedFromRemoval([only], [only.id])]).toEqual(['start'])
  })
})
