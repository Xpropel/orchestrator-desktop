import { initTheme } from '@/app/theme'
import { loadLibrary } from '@/core/library'
import { setUnsavedConfirm } from '@/platform/platform'
import { showUnsavedDialog } from '@/ui/unsaved-dialog'

loadLibrary()
initTheme()
setUnsavedConfirm(showUnsavedDialog)
