import { getDefaultForm, getNodeTypeForKind, getOperator, hasOperator } from '../registry'
import type { FlowNode, XYPosition } from '../types'
import {
  CONTAINER_DEFAULT_HEIGHT,
  CONTAINER_DEFAULT_WIDTH,
  LOOP_START_POSITION
} from './containers'
import { isStartNode } from './kind'
import { createNodeId, nextNodeName } from './naming'

export interface CreateOperatorOptions {
  parentId?: string
}

export function createStartNode(): FlowNode {
  const def = getOperator('start')
  return {
    id: 'start',
    type: getNodeTypeForKind('start'),
    position: { x: 80, y: 240 },
    data: {
      label: 'start',
      name: 'start',
      description: def.description,
      color: def.color,
      form: getDefaultForm('start')
    }
  }
}

export function createLoopStartNode(containerId: string, existingNodes: FlowNode[] = []): FlowNode {
  const def = hasOperator('loop-start') ? getOperator('loop-start') : null
  return {
    id: `${containerId}:start`,
    type: getNodeTypeForKind('loopStart'),
    parentId: containerId,
    position: { ...LOOP_START_POSITION },
    draggable: false,
    deletable: false,
    connectable: true,
    data: {
      label: 'loop-start',
      name: nextNodeName(existingNodes, 'loop-start'),
      description: def?.description,
      color: def?.color,
      form: {}
    }
  }
}

export function createOperatorNode(
  type: string,
  position: XYPosition,
  existingNodes: FlowNode[],
  options?: CreateOperatorOptions
): FlowNode {
  const def = getOperator(type)
  const nodeType = getNodeTypeForKind(def.kind)
  const parentId =
    options?.parentId && def.kind !== 'container' && def.kind !== 'start' ? options.parentId : undefined
  const initialStart = type === 'start' && !existingNodes.some(isStartNode)

  const node: FlowNode = {
    id: initialStart ? 'start' : createNodeId(type),
    type: nodeType,
    position,
    data: {
      label: type,
      name: initialStart ? 'start' : nextNodeName(existingNodes, type),
      description: def.description,
      color: def.color,
      form: getDefaultForm(type)
    },
    deletable: def.constraints?.deletable ?? true,
    connectable: def.kind !== 'note'
  }

  if (parentId) {
    node.parentId = parentId
  }

  if (def.kind === 'note') {
    node.style = { width: 200, height: 140 }
  }

  if (def.kind === 'container') {
    node.style = { width: CONTAINER_DEFAULT_WIDTH, height: CONTAINER_DEFAULT_HEIGHT }
    node.width = CONTAINER_DEFAULT_WIDTH
    node.height = CONTAINER_DEFAULT_HEIGHT
  }

  return node
}
