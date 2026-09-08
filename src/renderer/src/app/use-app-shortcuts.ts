import { useEffect } from 'react'
import { runMenuAction } from '@/app/menu-actions'
import { openFlow } from '@/features/files/file-actions'
import { fileApi, isElectron } from '@/platform/platform'
import { useFlowStore } from '@/state/flow-store'
import { isTextInputTarget } from '@/ui/is-text-input-target'
import type { MenuAction } from '../../../preload/index.d'

/** 浏览器模式快捷键映射。文本框内只放行保存，不抢新建/打开/导入，也不接管编辑键。 */
export function resolveBrowserShortcut(event: KeyboardEvent): MenuAction | null {
  const key = event.key.toLowerCase()
  const mod = event.ctrlKey || event.metaKey
  const inText = isTextInputTarget(event.target)

  if (!mod) {
    if (inText) return null
    if (event.key === 'Delete' || event.key === 'Backspace') return 'delete'
    return null
  }

  if (key === 's') return event.shiftKey ? 'saveAs' : 'save'
  if (inText) return null

  if (key === 'n') return 'new'
  if (key === 'o') return 'open'
  if (key === 'i') return 'importJson'

  if (key === 'z' && event.shiftKey) return 'redo'
  if (key === 'z') return 'undo'
  if (key === 'y' && event.ctrlKey) return 'redo'
  if (key === 'c') return 'copy'
  if (key === 'v') return 'paste'
  if (key === 'd') return 'duplicate'
  return null
}

export function useAppShortcuts(): void {
  useEffect(() => {
    const initial = useFlowStore.getState()
    fileApi.setDirty(initial.dirty)
    fileApi.setDocumentTitle(initial.title)
    fileApi.setFilePath(initial.filePath)
    return useFlowStore.subscribe((state, prev) => {
      if (state.dirty !== prev.dirty) {
        fileApi.setDirty(state.dirty)
      }
      if (state.title !== prev.title) {
        fileApi.setDocumentTitle(state.title)
      }
      if (state.filePath !== prev.filePath) {
        fileApi.setFilePath(state.filePath)
      }
    })
  }, [])

  useEffect(() => {
    return fileApi.onOpenPath((filePath) => {
      void openFlow(filePath)
    })
  }, [])

  useEffect(() => {
    // Electron 下由主进程 close-guard 弹三选一对话框；这里若再拦截，用户选「不保存」后
    // store 仍是 dirty，beforeunload 返回非 undefined 会让 Electron 静默取消关闭。
    if (isElectron()) {
      return
    }
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!useFlowStore.getState().dirty) {
        return
      }
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    if (isElectron() && typeof window.api !== 'undefined') {
      return fileApi.onMenuAction((action) => runMenuAction(action))
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const action = resolveBrowserShortcut(event)
      if (!action) {
        return
      }
      event.preventDefault()
      runMenuAction(action)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
