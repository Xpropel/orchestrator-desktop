import type { NodeTypes } from '@xyflow/react'
import { BranchNode } from './branch-node'
import { BreakNode } from './break-node'
import { ContainerNode } from './container-node'
import { EndNode } from './end-node'
import { LoopStartNode } from './loop-start-node'
import { NoteNode } from './note-node'
import { StartNode } from './start-node'
import { TaskNode } from './task-node'

export const nodeTypes: NodeTypes = {
  startNode: StartNode,
  endNode: EndNode,
  taskNode: TaskNode,
  branchNode: BranchNode,
  containerNode: ContainerNode,
  loopStartNode: LoopStartNode,
  breakNode: BreakNode,
  noteNode: NoteNode
}
