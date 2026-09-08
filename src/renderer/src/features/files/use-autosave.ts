import { useEffect } from 'react'
import { isElectron } from '@/platform/platform'
import { subscribeAutosave } from './autosave'

/**
 * 定时把已命名的脏文件写回原路径。
 * 浏览器模式的 saveFlow 只能触发下载，不能静默覆盖，因此仅 Electron 启用。
 * 未命名文件不自动保存，仍由崩溃恢复兜底。
 */
export function useAutosave(): void {
  useEffect(() => {
    if (!isElectron()) {
      return
    }
    return subscribeAutosave()
  }, [])
}
