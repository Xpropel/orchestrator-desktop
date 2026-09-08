import { memo, type JSX } from 'react'
import { Handle, type HandleProps } from '@xyflow/react'
import { cn } from '@/ui/cn'

export const FlowHandle = memo(function FlowHandle({
  className,
  type,
  ...props
}: HandleProps): JSX.Element {
  return (
    <Handle
      type={type}
      className={cn(
        'orchestrator-handle',
        type === 'source' ? 'orchestrator-handle-source' : 'orchestrator-handle-target',
        className
      )}
      {...props}
    />
  )
})
