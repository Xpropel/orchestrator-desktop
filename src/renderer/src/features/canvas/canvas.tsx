import { useCallback, useEffect, useState } from 'react'
import type { DragEvent, JSX, MouseEvent as ReactMouseEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type DefaultEdgeOptions,
  type IsValidConnection,
  type OnBeforeDelete,
  type OnConnectEnd,
  type OnNodeDrag
} from '@xyflow/react'
import { edgeTypes } from '@/features/canvas/edges'
import { nodeTypes } from '@/features/canvas/nodes'
import { OperatorPicker, type OperatorPickerMode } from '@/features/canvas/operator-picker'
import { useAddNode } from '@/features/canvas/use-add-node'
import { useClipboard } from '@/features/canvas/use-clipboard'
import { useHistory } from '@/features/canvas/use-history'
import { runAutoLayout } from '@/features/canvas/run-auto-layout'
import {
  collectDescendantIds,
  explainInvalidConnection,
  findContainingContainer,
  idsProtectedFromRemoval,
  isDuplicateConnection,
  isLoopStartNode,
  isProtectedNode,
  isStartNode,
  isValidFlowConnection,
  resolveParentAfterDrag
} from '@/core/graph'
import { getOperator, getTargetHandles, hasOperator } from '@/core/registry'
import { HANDLE_END, HANDLE_START, logicalHandleId } from '@/core/handles'
import { isSourceOrAncestor, mergeNodeMetrics, pickDropTargetNode } from '@/features/canvas/drop-target'
import {
  toCanvasEdges,
  toCanvasNode,
  toCanvasNodes,
  toFlowNode,
  type CanvasEdge,
  type CanvasNode
} from '@/features/canvas/flow-types'
import { CATEGORY_DRAG_MIME, OPERATOR_DRAG_MIME } from '@/shared/mime'
import { isTextInputTarget } from '@/ui/is-text-input-target'
import { useThemeStore } from '@/state/theme-store'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'
import { CanvasToolbar } from './canvas-toolbar'
import { ContextMenu, type ContextMenuState } from './context-menu/context-menu'

const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'buttonEdge',
  animated: false,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color: '#6e7681'
  }
}

interface PickerState {
  x: number
  y: number
  mode: OperatorPickerMode
  flowPosition: { x: number; y: number }
  parentId: string | null
  connect?: { source: string; sourceHandle: string | null }
}

function clientPoint(event: MouseEvent | TouchEvent): { x: number; y: number } {
  if ('changedTouches' in event) {
    const touch = event.changedTouches[0]
    if (touch) return { x: touch.clientX, y: touch.clientY }
  }
  const mouse = event as MouseEvent
  return { x: mouse.clientX, y: mouse.clientY }
}

function FlowCanvas(): JSX.Element {
  const nodes = useFlowStore((state) => state.nodes)
  const edges = useFlowStore((state) => state.edges)
  const onNodesChange = useFlowStore((state) => state.onNodesChange)
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange)
  const onConnect = useFlowStore((state) => state.onConnect)
  const selectNode = useFlowStore((state) => state.selectNode)
  const setViewport = useFlowStore((state) => state.setViewport)
  const copySelected = useFlowStore((state) => state.copySelected)
  const pasteClipboard = useFlowStore((state) => state.pasteClipboard)
  const removeNode = useFlowStore((state) => state.removeNode)
  const viewportRequest = useFlowStore((state) => state.viewportRequest)
  const mode = useThemeStore((state) => state.mode)
  const setOpenCategory = useUiStore((state) => state.setOpenCategory)
  const openInspector = useUiStore((state) => state.openInspector)
  const closeInspector = useUiStore((state) => state.closeInspector)

  const { screenToFlowPosition, fitView, getNodes } = useReactFlow()
  const { addAtFlowPosition } = useAddNode()
  const { hasClipboard } = useClipboard()
  useHistory()
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [picker, setPicker] = useState<PickerState | null>(null)
  const nodesInitialized = useNodesInitialized()
  const [fitPending, setFitPending] = useState(false)

  useEffect(() => {
    if (viewportRequest === 0) {
      return
    }
    setFitPending(true)
  }, [viewportRequest])

  // 载入文档后节点尚未量测；React Flow 会把 fitView 挂起到首次 updateNodeInternals，
  // 而任何节点（例如端口重测）提前触发它都会只按已量测的节点取景。等全部节点量测完再取景。
  useEffect(() => {
    if (!fitPending || !nodesInitialized) {
      return
    }
    setFitPending(false)
    void fitView({ padding: 0.2 })
  }, [fitPending, nodesInitialized, fitView])

  useEffect(() => {
    const onFocus = (event: Event): void => {
      const detail = (event as CustomEvent<{ nodeId?: string }>).detail
      const nodeId = detail?.nodeId
      if (!nodeId) return
      selectNode(nodeId)
      openInspector(nodeId)
      void fitView({ nodes: [{ id: nodeId }], duration: 300, maxZoom: 1.2 })
    }
    window.addEventListener('flow:focus-node', onFocus)
    return () => window.removeEventListener('flow:focus-node', onFocus)
  }, [fitView, selectNode, openInspector])

  const isValidConnection = useCallback<IsValidConnection<CanvasEdge>>((connection) => {
    const state = useFlowStore.getState()
    return isValidFlowConnection(state.nodes, state.edges, {
      source: connection.source ?? null,
      target: connection.target ?? null,
      sourceHandle: logicalHandleId(connection.sourceHandle),
      targetHandle: logicalHandleId(connection.targetHandle)
    })
  }, [])

  const onBeforeDelete = useCallback<OnBeforeDelete<CanvasNode, CanvasEdge>>(async ({ nodes: toDelete, edges: toDeleteEdges }) => {
    if (isTextInputTarget(document.activeElement)) {
      return false
    }
    const all = useFlowStore.getState().nodes
    const deleting = new Set(toDelete.map((node) => node.id))
    const expanded: CanvasNode[] = [...toDelete]
    for (const node of toDelete) {
      for (const childId of collectDescendantIds(all, node.id)) {
        if (deleting.has(childId)) continue
        const child = all.find((item) => item.id === childId)
        if (child) {
          expanded.push(toCanvasNode(child))
          deleting.add(childId)
        }
      }
    }
    const protectedIds = idsProtectedFromRemoval(all, deleting)
    const removable = expanded.filter((node) => {
      const flow = toFlowNode(node)
      if (isLoopStartNode(flow)) {
        return Boolean(flow.parentId && deleting.has(flow.parentId))
      }
      return !protectedIds.has(flow.id)
    })
    if (removable.length === 0 && toDeleteEdges.length === 0) {
      return false
    }
    return { nodes: removable, edges: toDeleteEdges }
  }, [])

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setMenu(null)
      setOpenCategory(null)
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const category = event.dataTransfer.getData(CATEGORY_DRAG_MIME)
      if (category) {
        const hit = findContainingContainer(flowPos, useFlowStore.getState().nodes)
        setPicker({
          x: event.clientX,
          y: event.clientY,
          mode: { kind: 'category', categoryKey: category },
          flowPosition: flowPos,
          parentId: hit?.id ?? null
        })
        return
      }
      const raw = event.dataTransfer.getData(OPERATOR_DRAG_MIME)
      if (!hasOperator(raw)) return
      const hit = findContainingContainer(flowPos, useFlowStore.getState().nodes)
      addAtFlowPosition(raw, flowPos, { parentId: hit?.id })
    },
    [addAtFlowPosition, screenToFlowPosition, setOpenCategory]
  )

  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      if (!connectionState.fromNode) return
      if (connectionState.fromHandle?.type !== 'source') return
      const point = clientPoint(event)
      const flowPos = screenToFlowPosition(point)
      const from = connectionState.fromNode
      const sourceHandle = logicalHandleId(connectionState.fromHandle?.id) ?? HANDLE_START
      const state = useFlowStore.getState()
      const measured = mergeNodeMetrics(state.nodes, (getNodes() as CanvasNode[]).map(toFlowNode))
      // 起点自身和它所在的容器不算落点：从循环体内部拉到容器空白处，应当在容器内新建节点，而不是连到容器上。
      const nearHandle = connectionState.toNode?.id
      const hit =
        pickDropTargetNode(flowPos, measured, from.id) ??
        (nearHandle && !isSourceOrAncestor(state.nodes, from.id, nearHandle)
          ? state.nodes.find((node) => node.id === nearHandle)
          : undefined)
      if (hit) {
        const targetHandle = hasOperator(hit.data.label)
          ? (getTargetHandles(hit.data.label)[0]?.id ?? HANDLE_END)
          : HANDLE_END
        const connection = {
          source: from.id,
          sourceHandle,
          target: hit.id,
          targetHandle
        }
        if (isDuplicateConnection(state.edges, connection)) return
        const reason = explainInvalidConnection(state.nodes, state.edges, connection)
        if (reason) {
          useUiStore.getState().showToast(reason)
        } else {
          useFlowStore.getState().onConnect(connection)
        }
        return
      }
      const parentId = typeof from.parentId === 'string' ? from.parentId : null
      setPicker({
        x: point.x,
        y: point.y,
        mode: { kind: 'all' },
        flowPosition: flowPos,
        parentId,
        connect: {
          source: from.id,
          sourceHandle
        }
      })
    },
    [getNodes, screenToFlowPosition]
  )

  const onNodeClick = useCallback(
    (event: ReactMouseEvent, node: CanvasNode) => {
      setMenu(null)
      setPicker(null)
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        // 修饰键多选由 React Flow 的 select 变更写入 store，这里不再重复 selectNode，也不打开属性面板。
        return
      }
      // 只有真正的点击才打开属性面板；拖动结束时 React Flow 不会触发 onNodeClick。
      selectNode(node.id)
      openInspector(node.id)
    },
    [selectNode, openInspector]
  )

  const onPaneClick = useCallback(() => {
    setMenu(null)
    setPicker(null)
    selectNode(null)
    closeInspector()
  }, [selectNode, closeInspector])

  const onNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: CanvasNode) => {
      event.preventDefault()
      const alreadySelected = node.selected
      if (!alreadySelected) {
        selectNode(node.id)
      }
      setMenu({
        kind: 'node',
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        isLocked: isProtectedNode(toFlowNode(node), useFlowStore.getState().nodes)
      })
    },
    [selectNode]
  )

  const onPaneContextMenu = useCallback((event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault()
    setMenu({ kind: 'pane', x: event.clientX, y: event.clientY })
  }, [])

  const onNodeDragStop = useCallback<OnNodeDrag<CanvasNode>>(
    (event, node) => {
      const current = useFlowStore.getState().nodes
      const flow = toFlowNode(node)
      if (isStartNode(flow) || isProtectedNode(flow, current) || node.type === 'containerNode') {
        return
      }
      // React Flow 先派发最终 position change（dragging=false），再触发本回调，store 已是落点坐标。
      const latest = current.find((item) => item.id === node.id) ?? toFlowNode(node)
      // 以指针落点判定归属（用户直觉），节点重叠面积兜底。触摸事件取最后一个触点。
      const point =
        'clientX' in event
          ? { x: event.clientX, y: event.clientY }
          : event.changedTouches.length > 0
            ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
            : null
      const pointer = point ? screenToFlowPosition(point) : undefined
      const change = resolveParentAfterDrag(latest, current, pointer)
      if (change) {
        useFlowStore.getState().setNodeParent(latest.id, change.parentId, change.position)
      }
    },
    [screenToFlowPosition]
  )

  const handleMenuAddNote = useCallback(() => {
    if (!menu || menu.kind !== 'pane') return
    const flowPos = screenToFlowPosition({ x: menu.x, y: menu.y })
    addAtFlowPosition('note', flowPos)
  }, [addAtFlowPosition, menu, screenToFlowPosition])

  const handlePickerSelect = useCallback(
    (type: string) => {
      if (!picker) return
      const created = addAtFlowPosition(type, picker.flowPosition, {
        parentId: picker.parentId ?? undefined
      })
      setPicker(null)
      if (created && picker.connect) {
        const targetHandle = hasOperator(created.data.label)
          ? (getTargetHandles(created.data.label)[0]?.id ?? HANDLE_END)
          : HANDLE_END
        useFlowStore.getState().onConnect({
          source: picker.connect.source,
          sourceHandle: logicalHandleId(picker.connect.sourceHandle) ?? HANDLE_START,
          target: created.id,
          targetHandle: logicalHandleId(targetHandle) ?? HANDLE_END
        })
      }
    },
    [addAtFlowPosition, picker]
  )

  return (
    <div className="relative h-full w-full">
      <ReactFlow<CanvasNode, CanvasEdge>
        nodes={toCanvasNodes(nodes)}
        edges={toCanvasEdges(edges)}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        minZoom={0.1}
        snapToGrid={false}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={36}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 1.6, strokeDasharray: '6 4' }}
        isValidConnection={isValidConnection}
        onBeforeDelete={onBeforeDelete}
        selectionOnDrag
        panOnDrag={[1, 2]}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onNodeDragStop={onNodeDragStop}
        onMove={(_, viewport) => setViewport(viewport)}
        onInit={(instance) => setViewport(instance.getViewport())}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className="h-full w-full bg-base"
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--border)" />
        <Controls position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const label = node.data.label
            return typeof label === 'string' && hasOperator(label) ? getOperator(label).color : '#94a3b8'
          }}
          maskColor={mode === 'light' ? 'rgba(246, 248, 250, 0.7)' : 'rgba(13, 17, 23, 0.7)'}
          className="!bg-panel !border-border"
        />
      </ReactFlow>
      <CanvasToolbar />
      {menu ? (
        <ContextMenu
          menu={menu}
          hasClipboard={hasClipboard}
          onClose={() => setMenu(null)}
          onCopy={copySelected}
          onDelete={() => {
            if (menu.kind === 'node') removeNode(menu.nodeId)
          }}
          onPaste={pasteClipboard}
          onAddNote={handleMenuAddNote}
          onFitView={() => {
            void fitView({ padding: 0.2 })
          }}
          onAutoLayout={runAutoLayout}
        />
      ) : null}
      {picker ? (
        <OperatorPicker
          x={picker.x}
          y={picker.y}
          mode={picker.mode}
          onSelect={handlePickerSelect}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  )
}

export function Canvas(): JSX.Element {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <FlowCanvas />
      </ReactFlowProvider>
    </div>
  )
}
