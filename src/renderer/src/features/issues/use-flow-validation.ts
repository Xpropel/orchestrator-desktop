import { useEffect } from 'react'
import { validateFlow } from '@/core/validate'
import { useFlowStore } from '@/state/flow-store'
import { useValidationStore } from '@/state/validation-store'

export function useFlowValidation(): void {
  const nodes = useFlowStore((state) => state.nodes)
  const edges = useFlowStore((state) => state.edges)
  const globals = useFlowStore((state) => state.globals)
  const setIssues = useValidationStore((state) => state.setIssues)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIssues(validateFlow(nodes, edges, globals))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [nodes, edges, globals, setIssues])
}
