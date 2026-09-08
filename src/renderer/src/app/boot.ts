import { initTheme } from '@/app/theme'
import { loadLibrary } from '@/core/library'
import { fileApi, setUnsavedConfirm } from '@/platform/platform'
import { showUnsavedDialog } from '@/ui/unsaved-dialog'

function applyPlatformAttr(): void {
  if (typeof document === 'undefined') {
    return
  }
  document.documentElement.dataset.platform = fileApi.platform
}

loadLibrary()
initTheme()
applyPlatformAttr()
setUnsavedConfirm(showUnsavedDialog)
