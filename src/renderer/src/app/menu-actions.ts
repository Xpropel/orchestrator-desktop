import { importJson, newFlow, openExampleFlow, openFlow, saveFlow, saveFlowAs } from '@/features/files/file-actions'
import { runAutoLayout } from '@/features/canvas/run-auto-layout'
import { consumeTextInputAction } from '@/ui/text-input-edit'
import { useFlowStore } from '@/state/flow-store'
import type { MenuAction } from '../../../preload/index.d'
import { flushPendingTitleEdit } from './title-edit'

const EXAMPLE_ACTION_PREFIX = 'example:'

const FLUSH_TITLE_ACTIONS = new Set<MenuAction>(['new', 'open', 'importJson', 'save', 'saveAs'])

export function runMenuAction(action: MenuAction): void {
  if (action.startsWith(EXAMPLE_ACTION_PREFIX)) {
    flushPendingTitleEdit()
    void openExampleFlow(action.slice(EXAMPLE_ACTION_PREFIX.length))
    return
  }
  if (consumeTextInputAction(action)) return
  if (FLUSH_TITLE_ACTIONS.has(action)) {
    flushPendingTitleEdit()
  }

  switch (action) {
    case 'new':
      void newFlow()
      break
    case 'open':
      void openFlow()
      break
    case 'importJson':
      void importJson()
      break
    case 'save':
      void saveFlow()
      break
    case 'saveAs':
      void saveFlowAs()
      break
    case 'undo':
      useFlowStore.getState().undo()
      break
    case 'redo':
      useFlowStore.getState().redo()
      break
    case 'copy':
      useFlowStore.getState().copySelected()
      break
    case 'paste':
      useFlowStore.getState().pasteClipboard()
      break
    case 'duplicate':
      useFlowStore.getState().duplicateSelected()
      break
    case 'delete':
      useFlowStore.getState().removeSelected()
      break
    case 'fitView':
      useFlowStore.getState().requestFitView()
      break
    case 'autoLayout':
      runAutoLayout()
      break
  }
}
