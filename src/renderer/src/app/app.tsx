import type { JSX } from 'react'
import { Canvas } from '@/features/canvas/canvas'
import { useAddNode } from '@/features/canvas/use-add-node'
import { FloatingInspector } from '@/features/inspector/floating-inspector'
import { IssuesPanel } from '@/features/issues/issues-panel'
import { OperatorFlyout } from '@/features/palette/operator-flyout'
import { Sidebar } from '@/features/palette/sidebar'
import { Toolbar } from '@/app/toolbar'
import { UnsavedDialogHost } from '@/ui/unsaved-dialog'
import { useAppShortcuts } from '@/app/use-app-shortcuts'
import { useAutosave } from '@/features/files/use-autosave'
import { useCrashRecovery } from '@/features/files/use-crash-recovery'
import { useFileDrop } from '@/features/files/use-file-drop'
import { useFlowValidation } from '@/features/issues/use-flow-validation'
import { useUiStore } from '@/state/ui-store'

export default function App(): JSX.Element {
  useAppShortcuts()
  useCrashRecovery()
  useFileDrop()
  useAutosave()
  useFlowValidation()
  const { addAtViewportCenter } = useAddNode()
  const issuesOpen = useUiStore((state) => state.issuesPanelOpen)
  const toast = useUiStore((state) => state.toast)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-base text-primary">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="relative flex h-full shrink-0">
          <Sidebar onAddOperator={addAtViewportCenter} />
          <OperatorFlyout onAddOperator={addAtViewportCenter} />
        </div>
        <main className="relative min-w-0 flex-1">
          <Canvas />
          <FloatingInspector />
        </main>
      </div>
      {issuesOpen ? <IssuesPanel /> : null}
      <UnsavedDialogHost />
      {toast ? (
        <div
          data-testid="toast"
          className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-panel px-3 py-2 text-sm text-primary shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
