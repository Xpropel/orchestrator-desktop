import { useEffect, useRef, useState, type JSX } from 'react'
import { ChevronDown } from 'lucide-react'
import { openFlow } from '@/features/files/file-actions'
import { fileApi } from '@/platform/platform'
import { ToolButton } from '@/ui/tool-button'

export function RecentFilesMenu(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  const refresh = (): void => {
    void fileApi.getRecentFiles().then(setRecent)
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    refresh()
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
      <ToolButton onClick={() => setOpen((value) => !value)} aria-label="最近打开的文件">
        <ChevronDown className="h-3 w-3" />
      </ToolButton>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-border bg-panel py-1 shadow-lg">
          {recent.length === 0 ? (
            <p className="px-3 py-2 text-xs text-secondary">暂无最近文件</p>
          ) : (
            recent.map((path) => (
              <button
                key={path}
                type="button"
                className="block w-full truncate px-3 py-1.5 text-left text-xs text-primary hover:bg-elevated"
                title={path}
                onClick={() => {
                  setOpen(false)
                  void openFlow(path)
                }}
              >
                {path}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
