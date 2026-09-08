import { memo, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import { cn } from '@/ui/cn'
import type { CanvasNode } from '@/features/canvas/flow-types'
import { useFlowStore } from '@/state/flow-store'
import { NodeHoverToolbar } from './node-hover-toolbar'
import { NodeIssueBadge } from './node-issue-badge'

function asNoteText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export const NoteNode = memo(function NoteNode({
  id,
  data,
  selected
}: NodeProps<CanvasNode>): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const text = asNoteText(data.form.text)
  const updateNodeForm = useFlowStore((state) => state.updateNodeForm)

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }
  }, [editing])

  return (
    <div
      className={cn(
        'orchestrator-note relative h-full min-h-[100px] min-w-[160px] rounded-md border border-amber-700/40 bg-[#f5d67b] text-[#3f2f0c] shadow-md',
        selected && 'orchestrator-card-selected'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={() => setEditing(true)}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        color="var(--accent)"
      />
      <NodeIssueBadge nodeId={id} />
      <NodeHoverToolbar nodeId={id} visible={hovered || selected} showDelete />
      {editing ? (
        <textarea
          ref={textareaRef}
          className="nodrag nowheel h-full w-full resize-none bg-transparent px-3 py-3 text-sm outline-none"
          value={text}
          onChange={(event) => updateNodeForm(id, { text: event.target.value })}
          onBlur={() => {
            setEditing(false)
            useFlowStore.getState().recordHistory()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Delete' || event.key === 'Backspace') {
              event.stopPropagation()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setEditing(false)
              useFlowStore.getState().recordHistory()
            }
          }}
        />
      ) : (
        <div className="h-full whitespace-pre-wrap px-3 py-3 text-sm">
          {text || '双击编辑便签'}
        </div>
      )}
    </div>
  )
})
