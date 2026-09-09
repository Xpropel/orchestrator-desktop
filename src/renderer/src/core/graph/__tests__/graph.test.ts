import { beforeAll, describe, expect, it } from 'vitest'
import { loadLibrary } from '../../library'
import { getSourceHandles } from '../../registry'
import type { FlowConnection, FlowEdge, FlowNode } from '../../types'
import {
  CONTAINER_DEFAULT_HEIGHT,
  CONTAINER_DEFAULT_WIDTH,
  CONTAINER_PORT_GUTTER,
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
  planDragParentChanges,
  remapClipboard,
  resolvePasteParentId,
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

  it('allows if/switch case and else outlets and rejects a missing branch handle', () => {
    const iff = node('iff', 'if', {
      type: 'branchNode',
      data: { label: 'if', name: 'If_1', form: { cases: [{ id: 'c1', label: 'Yes', expression: 'x' }] } }
    })
    const sw = node('sw', 'switch', {
      type: 'branchNode',
      data: { label: 'switch', name: 'Switch_1', form: { cases: [{ id: 'c1', label: 'A', expression: '1' }] } }
    })
    const merge = node('m', 'merge', { type: 'taskNode' })
    const branched = [...nodes, iff, sw, merge]
    expect(getSourceHandles('if', iff.data.form).map((handle) => handle.id)).toEqual(['c1', 'else'])
    expect(isValidFlowConnection(branched, [], connection('iff', 'a', 'c1'))).toBe(true)
    expect(isValidFlowConnection(branched, [], connection('iff', 'b', 'else'))).toBe(true)
    expect(isValidFlowConnection(branched, [], connection('sw', 'end', 'else'))).toBe(true)
    expect(isValidFlowConnection(branched, [], connection('iff', 'start', 'c1'))).toBe(false)
    expect(isValidFlowConnection(branched, [edge('e1', 'iff', 'a', 'c1')], connection('a', 'iff'))).toBe(false)
    expect(explainInvalidConnection(branched, [], connection('sw', 'sw', 'c1'))).toBe('不能连接：不能连到自己')
    expect(explainInvalidConnection(branched, [], connection('iff', 'a', 'start'))).toBe('不能连接：无效的出口')
    expect(explainInvalidConnection(branched, [], connection('sw', 'a'))).toBe('不能连接：无效的出口')
    expect(explainInvalidConnection(branched, [], connection('a', 'b', 'else'))).toBe('不能连接：无效的出口')
    expect(isValidFlowConnection(branched, [], connection('a', 'm'))).toBe(true)
    expect(isValidFlowConnection(branched, [edge('e1', 'a', 'm')], connection('b', 'm'))).toBe(true)
    expect(isValidFlowConnection(branched, [edge('e1', 'a', 'm')], connection('a', 'm'))).toBe(false)
  })

  it('treats physical start ports as the logical start handle', () => {
    expect(isValidFlowConnection(nodes, [], connection('a', 'b', 'start#new'))).toBe(true)
    expect(isValidFlowConnection(nodes, [edge('e1', 'a', 'b')], connection('a', 'b', 'start#1'))).toBe(false)
    expect(explainInvalidConnection(nodes, [edge('e1', 'a', 'b')], connection('b', 'a', 'start#new'))).toBe(
      '不能连接：会形成环'
    )
  })

  it('still accepts start#new after many outgoing start edges, and only rejects the duplicate target', () => {
    const fan = [
      node('src', 'agent', { type: 'taskNode' }),
      node('t1', 'message', { type: 'taskNode' }),
      node('t2', 'message', { type: 'taskNode' }),
      node('t3', 'message', { type: 'taskNode' }),
      node('t4', 'message', { type: 'taskNode' }),
      node('t5', 'code', { type: 'taskNode' }),
      node('t6', 'code', { type: 'taskNode' })
    ]
    const edges = [
      edge('e1', 'src', 't1'),
      edge('e2', 'src', 't2'),
      edge('e3', 'src', 't3'),
      edge('e4', 'src', 't4'),
      edge('e5', 'src', 't5')
    ]
    expect(isValidFlowConnection(fan, edges, connection('src', 't6', 'start#new'))).toBe(true)
    expect(hasMatchingConnection(edges, { source: 'src', target: 't6', sourceHandle: 'start#new' })).toBe(
      false
    )
    expect(isValidFlowConnection(fan, edges, connection('src', 't3', 'start#new'))).toBe(false)
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
    expect(attach).toEqual({ parentId: 'loop', position: { x: 152, y: 200 } })
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
          extent: 'parent',
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
    expect(agent?.extent).toBeUndefined()
    expect(loop?.position).toEqual({ x: 50, y: 60 })
    expect(start?.position).toEqual({ x: 24, y: 56 })
    expect(remapped.edges).toHaveLength(1)
    expect(remapped.edges[0].source).toBe(start?.id)
    expect(remapped.edges[0].target).toBe(agent?.id)
  })

  it('retargets orphan copies into another container and detaches them on the pane', () => {
    const source = node('loop-a', 'foreach', { type: 'containerNode', position: { x: 0, y: 0 } })
    const dest = node('loop-b', 'foreach', { type: 'containerNode', position: { x: 600, y: 0 } })
    const inner = node('inner', 'agent', {
      type: 'taskNode',
      parentId: 'loop-a',
      position: { x: 40, y: 80 }
    })
    const payload = { nodes: [inner], edges: [] }
    const intoB = remapClipboard(payload, [source, dest, inner], { x: 40, y: 40 }, { targetParentId: 'loop-b' })
    expect(intoB.nodes).toHaveLength(1)
    expect(intoB.nodes[0]?.parentId).toBe('loop-b')
    expect(intoB.nodes[0]?.id).not.toBe('inner')

    const ontoPane = remapClipboard(payload, [source, dest, inner], { x: 40, y: 40 }, { targetParentId: null })
    expect(ontoPane.nodes[0]?.parentId).toBeUndefined()
    expect(ontoPane.nodes[0]?.position).toEqual({ x: 80, y: 120 })
  })

  it('clamps an orphan pasted into a dest container off CONTAINER_PORT_GUTTER', () => {
    const source = node('loop-a', 'foreach', { type: 'containerNode', position: { x: 0, y: 0 }, width: 560, height: 340 })
    const dest = node('loop-b', 'foreach', {
      type: 'containerNode',
      position: { x: 600, y: 0 },
      width: 400,
      height: 300
    })
    const inner = node('inner', 'agent', {
      type: 'taskNode',
      parentId: 'loop-a',
      position: { x: 200, y: 80 },
      width: 240,
      height: 80
    })
    const intoB = remapClipboard({ nodes: [inner], edges: [] }, [source, dest, inner], { x: 40, y: 40 }, {
      targetParentId: 'loop-b'
    })
    const maxX = 400 - 240 - CONTAINER_PORT_GUTTER
    expect(intoB.nodes[0]?.parentId).toBe('loop-b')
    expect(intoB.nodes[0]?.position.x).toBe(maxX)
    expect(intoB.nodes[0]?.position.x).toBeLessThanOrEqual(maxX)
  })

  it('omitted or undefined targetParentId keeps the original container (duplicate)', () => {
    const source = node('loop-a', 'foreach', { type: 'containerNode', position: { x: 100, y: 80 } })
    const inner = node('inner', 'agent', {
      type: 'taskNode',
      parentId: 'loop-a',
      position: { x: 40, y: 90 }
    })
    const payload = { nodes: [inner], edges: [] }
    const omitted = remapClipboard(payload, [source, inner], { x: 40, y: 40 })
    expect(omitted.nodes[0]?.parentId).toBe('loop-a')
    expect(omitted.nodes[0]?.position).toEqual({ x: 80, y: 130 })

    const explicitUndefined = remapClipboard(payload, [source, inner], { x: 40, y: 40 }, {
      targetParentId: undefined
    })
    expect(explicitUndefined.nodes[0]?.parentId).toBe('loop-a')
  })

  it('remaps nested container children even when the payload lists descendants first', () => {
    const existing = [node('start', 'start', { type: 'startNode' })]
    const payload = {
      nodes: [
        node('old-inner:start', 'loop-start', {
          type: 'loopStartNode',
          parentId: 'old-inner',
          position: { x: 24, y: 56 },
          data: { label: 'loop-start', name: 'loop-start_1', form: {} }
        }),
        node('old-agent', 'agent', {
          type: 'taskNode',
          parentId: 'old-inner',
          position: { x: 40, y: 80 },
          data: { label: 'agent', name: 'agent_1', form: {} }
        }),
        node('old-inner', 'foreach', {
          type: 'containerNode',
          parentId: 'old-outer',
          position: { x: 20, y: 40 },
          data: { label: 'foreach', name: 'foreach_1', form: {} }
        }),
        node('old-outer:start', 'loop-start', {
          type: 'loopStartNode',
          parentId: 'old-outer',
          position: { x: 24, y: 56 },
          data: { label: 'loop-start', name: 'loop-start_2', form: {} }
        }),
        node('old-outer', 'foreach', {
          type: 'containerNode',
          position: { x: 10, y: 20 },
          data: { label: 'foreach', name: 'foreach_2', form: {} }
        })
      ],
      edges: [edge('e1', 'old-inner:start', 'old-agent')]
    }
    const remapped = remapClipboard(payload, existing, { x: 40, y: 40 })
    const outer = remapped.nodes.find((item) => item.id !== 'old-outer' && !item.parentId && item.data.label === 'foreach')
    const inner = remapped.nodes.find((item) => item.parentId === outer?.id && item.data.label === 'foreach')
    const innerStart = remapped.nodes.find((item) => item.type === 'loopStartNode' && item.parentId === inner?.id)
    const agent = remapped.nodes.find((item) => item.data.label === 'agent')
    expect(outer).toBeDefined()
    expect(inner).toBeDefined()
    expect(innerStart?.id).toBe(`${inner?.id}:start`)
    expect(agent?.parentId).toBe(inner?.id)
    expect(remapped.edges[0]?.source).toBe(innerStart?.id)
    expect(remapped.edges[0]?.target).toBe(agent?.id)
  })

  it('does not nest a pasted while/foreach into another container', () => {
    const dest = node('loop-b', 'foreach', { type: 'containerNode', position: { x: 600, y: 0 } })
    const payload = {
      nodes: [node('w', 'while', { type: 'containerNode', position: { x: 20, y: 20 } })],
      edges: []
    }
    const pasted = remapClipboard(payload, [dest], { x: 40, y: 40 }, { targetParentId: dest.id })
    expect(pasted.nodes[0]?.data.label).toBe('while')
    expect(pasted.nodes[0]?.parentId).toBeUndefined()
    expect(resolveParentAfterDrag(payload.nodes[0]!, [dest, payload.nodes[0]!], { x: 680, y: 40 })).toBeNull()
  })

  it('resolvePasteParentId prefers a selected destination container', () => {
    const source = node('loop-a', 'foreach', { type: 'containerNode' })
    const dest = node('loop-b', 'foreach', { type: 'containerNode' })
    const inner = node('inner', 'agent', { type: 'taskNode', parentId: 'loop-a' })
    const payload = { nodes: [inner], edges: [] }
    expect(resolvePasteParentId(payload, [source, dest, inner], ['loop-b'])).toBe('loop-b')
    expect(resolvePasteParentId(payload, [source, dest, inner], ['inner'])).toBeUndefined()
    expect(resolvePasteParentId(payload, [source, dest, inner], [])).toBeNull()
  })

  it('resolvePasteParentId uses a destination child or siblings that share a parent', () => {
    const source = node('loop-a', 'foreach', { type: 'containerNode' })
    const dest = node('loop-b', 'foreach', { type: 'containerNode' })
    const copied = node('copied', 'agent', { type: 'taskNode', parentId: 'loop-a' })
    const destChild = node('in-b', 'agent', { type: 'taskNode', parentId: 'loop-b' })
    const destSibling = node('in-b-2', 'message', { type: 'taskNode', parentId: 'loop-b' })
    const payload = { nodes: [copied], edges: [] }
    expect(resolvePasteParentId(payload, [source, dest, copied, destChild], ['in-b'])).toBe('loop-b')
    expect(
      resolvePasteParentId(payload, [source, dest, copied, destChild, destSibling], ['in-b', 'in-b-2'])
    ).toBe('loop-b')
    expect(resolvePasteParentId(payload, [source, dest, copied], ['copied'])).toBeUndefined()
    expect(resolvePasteParentId(payload, [source, dest, copied], ['start'])).toBeNull()
  })

  it('does not detach onlyInsideContainer (break) onto the pane', () => {
    const source = node('loop-a', 'foreach', {
      type: 'containerNode',
      position: { x: 100, y: 80 },
      width: 560,
      height: 340
    })
    const dest = node('loop-b', 'foreach', { type: 'containerNode', position: { x: 600, y: 0 } })
    const brk = node('brk', 'break', {
      type: 'breakNode',
      parentId: 'loop-a',
      position: { x: 40, y: 90 }
    })
    const payload = { nodes: [brk], edges: [] }
    const ontoPane = remapClipboard(payload, [source, dest, brk], { x: 40, y: 40 }, { targetParentId: null })
    expect(ontoPane.nodes).toHaveLength(1)
    expect(ontoPane.nodes[0]?.parentId).toBe('loop-a')
    expect(ontoPane.nodes[0]?.position).toEqual({ x: 80, y: 130 })

    const intoB = remapClipboard(payload, [source, dest, brk], { x: 40, y: 40 }, { targetParentId: 'loop-b' })
    expect(intoB.nodes[0]?.parentId).toBe('loop-b')

    const orphaned = remapClipboard(payload, [dest], { x: 40, y: 40 }, { targetParentId: null })
    expect(orphaned.nodes).toHaveLength(0)
  })

  it('pane retarget detaches ordinary siblings but keeps break inside its container', () => {
    const source = node('loop-a', 'foreach', { type: 'containerNode', position: { x: 100, y: 80 } })
    const agent = node('inner', 'agent', {
      type: 'taskNode',
      parentId: 'loop-a',
      position: { x: 40, y: 80 }
    })
    const brk = node('brk', 'break', {
      type: 'breakNode',
      parentId: 'loop-a',
      position: { x: 40, y: 160 }
    })
    const remapped = remapClipboard({ nodes: [agent, brk], edges: [] }, [source, agent, brk], { x: 40, y: 40 }, {
      targetParentId: null
    })
    const pastedAgent = remapped.nodes.find((item) => item.data.label === 'agent')
    const pastedBreak = remapped.nodes.find((item) => item.data.label === 'break')
    expect(pastedAgent?.parentId).toBeUndefined()
    expect(pastedAgent?.position).toEqual({ x: 180, y: 200 })
    expect(pastedBreak?.parentId).toBe('loop-a')
    expect(pastedBreak?.position).toEqual({ x: 80, y: 200 })
  })

  it('copy children only does not expand the container; copy container includes descendants', () => {
    const nodes = [
      node('start', 'start', { type: 'startNode' }),
      node('loop', 'foreach', { type: 'containerNode' }),
      node('loop:start', 'loop-start', { type: 'loopStartNode', parentId: 'loop' }),
      node('a', 'agent', { type: 'taskNode', parentId: 'loop' }),
      node('b', 'message', { type: 'taskNode', parentId: 'loop' })
    ]
    expect(expandCopyIds(nodes, ['a', 'b']).sort()).toEqual(['a', 'b'])
    expect(extractSubgraph(nodes, [edge('e1', 'a', 'b'), edge('e2', 'loop:start', 'a')], ['a', 'b']).nodes.map((item) => item.id).sort()).toEqual([
      'a',
      'b'
    ])
    expect(expandCopyIds(nodes, ['loop', 'a']).sort()).toEqual(['a', 'b', 'loop', 'loop:start'])
  })

  it('collectDescendantIds ignores nodes that no longer use that parentId', () => {
    const source = node('loop-a', 'foreach', { type: 'containerNode' })
    const dest = node('loop-b', 'foreach', { type: 'containerNode' })
    const stayed = node('stay', 'agent', { type: 'taskNode', parentId: 'loop-a' })
    const moved = node('moved', 'message', { type: 'taskNode', parentId: 'loop-b' })
    expect(collectDescendantIds([source, dest, stayed, moved], 'loop-a')).toEqual(['stay'])
    expect(collectDescendantIds([source, dest, stayed, moved], 'loop-b')).toEqual(['moved'])
  })
})

describe('planDragParentChanges', () => {
  it('reparents every dragged sibling onto the pointer container', () => {
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
    const a = node('a', 'agent', {
      type: 'taskNode',
      parentId: 'loop',
      position: { x: 40, y: 80 },
      width: 240,
      height: 80
    })
    const b = node('b', 'agent', {
      type: 'taskNode',
      parentId: 'loop',
      position: { x: 40, y: 180 },
      width: 240,
      height: 80
    })
    const changes = planDragParentChanges([a, b], [box, other, a, b], { x: 600, y: 100 })
    expect(changes).toEqual([
      expect.objectContaining({ id: 'a', parentId: 'loop2' }),
      expect.objectContaining({ id: 'b', parentId: 'loop2' })
    ])
  })

  it('detaches every dragged sibling when the pointer lands on the pane', () => {
    const box = node('loop', 'foreach', {
      type: 'containerNode',
      position: { x: 0, y: 0 },
      width: 400,
      height: 300
    })
    const a = node('a', 'agent', {
      type: 'taskNode',
      parentId: 'loop',
      position: { x: 520, y: 400 },
      width: 240,
      height: 80
    })
    const b = node('b', 'agent', {
      type: 'taskNode',
      parentId: 'loop',
      position: { x: 520, y: 500 },
      width: 240,
      height: 80
    })
    a.measured = { width: 240, height: 80 }
    b.measured = { width: 240, height: 80 }
    const changes = planDragParentChanges([a, b], [box, a, b], { x: 900, y: 900 })
    expect(changes).toEqual([
      expect.objectContaining({ id: 'a', parentId: null }),
      expect.objectContaining({ id: 'b', parentId: null })
    ])
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

  it('only allows break inside a live container and never parents a container', () => {
    const box = createOperatorNode('foreach', { x: 0, y: 0 }, [])
    const agent = createOperatorNode('agent', { x: 400, y: 0 }, [box])
    expect(canAddOperator('break', [box], undefined)).toBe(false)
    expect(canAddOperator('break', [box], 'ghost')).toBe(false)
    expect(canAddOperator('break', [box, agent], agent.id)).toBe(false)
    expect(canAddOperator('break', [box], box.id)).toBe(true)
    expect(canAddOperator('while', [box], box.id)).toBe(false)
    expect(canAddOperator('while', [box])).toBe(true)
    expect(createOperatorNode('while', { x: 10, y: 10 }, [box], { parentId: box.id }).parentId).toBeUndefined()
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
