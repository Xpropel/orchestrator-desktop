import { useState, type DragEvent, type JSX } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { outgoingStartEdges } from '@/core/graph'
import { Button } from '@/ui/button'
import { cn } from '@/ui/cn'
import { useFlowStore } from '@/state/flow-store'

interface DownstreamRow {
  edgeId: string
  index: number
  name: string
}

export function DownstreamOrder({ nodeId }: { nodeId: string }): JSX.Element | null {
  const rows = useFlowStore(
    useShallow((state) => {
      const outgoing = outgoingStartEdges(state.edges, nodeId)
      if (outgoing.length < 2) return [] as DownstreamRow[]
      return outgoing.map((edge, index) => ({
        edgeId: edge.id,
        index,
        name: state.nodes.find((node) => node.id === edge.target)?.data.name ?? edge.target
      }))
    })
  )
  const moveOutgoingEdge = useFlowStore((state) => state.moveOutgoingEdge)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  if (rows.length < 2) return null

  const onDragStart = (event: DragEvent<HTMLLIElement>, edgeId: string): void => {
    setDraggingId(edgeId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', edgeId)
  }

  const onDragOver = (event: DragEvent<HTMLLIElement>, index: number): void => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setOverIndex(index)
  }

  const onDrop = (event: DragEvent<HTMLLIElement>, index: number): void => {
    event.preventDefault()
    const edgeId = event.dataTransfer.getData('text/plain') || draggingId
    if (edgeId) moveOutgoingEdge(edgeId, index)
    setDraggingId(null)
    setOverIndex(null)
  }

  return (
    <div data-testid="downstream-order">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">下游顺序</p>
      <ul className="flex flex-col gap-0.5 rounded-md border border-border bg-elevated/40 px-1.5 py-1.5 text-xs">
        {rows.map((row) => (
          <li
            key={row.edgeId}
            draggable
            onDragStart={(event) => onDragStart(event, row.edgeId)}
            onDragOver={(event) => onDragOver(event, row.index)}
            onDragEnd={() => {
              setDraggingId(null)
              setOverIndex(null)
            }}
            onDrop={(event) => onDrop(event, row.index)}
            className={cn(
              'flex items-center gap-1 rounded px-1 py-0.5',
              draggingId === row.edgeId && 'opacity-50',
              overIndex === row.index && 'bg-accent/10'
            )}
          >
            <span className="w-4 shrink-0 text-center font-mono text-secondary">{row.index + 1}</span>
            <span className="min-w-0 flex-1 cursor-grab truncate text-primary active:cursor-grabbing">
              {row.name}
            </span>
            <Button
              variant="ghost"
              className="h-6 w-6 px-0"
              disabled={row.index === 0}
              aria-label="上移"
              onClick={() => moveOutgoingEdge(row.edgeId, row.index - 1)}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              className="h-6 w-6 px-0"
              disabled={row.index === rows.length - 1}
              aria-label="下移"
              onClick={() => moveOutgoingEdge(row.edgeId, row.index + 1)}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
