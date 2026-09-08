import { useEffect, useRef, useState, type JSX } from 'react'
import { ChevronDown, Library } from 'lucide-react'
import { listExampleFlows, openExampleFlow, type ExampleFlow } from '@/features/files/file-actions'
import { ToolButton } from '@/ui/tool-button'

export function ExamplesMenu(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [examples, setExamples] = useState<ExampleFlow[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void listExampleFlows().then(setExamples)
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <ToolButton onClick={() => setOpen((value) => !value)} aria-label="示例模板" data-testid="examples-menu">
        <Library className="h-3.5 w-3.5" />
        示例
        <ChevronDown className="h-3 w-3" />
      </ToolButton>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-80 rounded-md border border-border bg-panel py-1 shadow-lg">
          {examples.length === 0 ? (
            <p className="px-3 py-2 text-xs text-secondary">暂无示例模板</p>
          ) : (
            examples.map((item) => (
              <button
                key={item.name}
                type="button"
                className="block w-full px-3 py-1.5 text-left hover:bg-elevated"
                onClick={() => {
                  setOpen(false)
                  void openExampleFlow(item.name)
                }}
              >
                <span className="block truncate text-xs text-primary">{item.title}</span>
                <span className="block truncate text-[11px] text-secondary">{item.description}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
