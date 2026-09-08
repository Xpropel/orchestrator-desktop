import { useEffect } from 'react'
import { restoreRecoveryIfPresent, subscribeDirtyRecovery } from './crash-recovery'

/**
 * 崩溃恢复：脏状态下定期把画布写入恢复快照（Electron 写 userData/recovery.flow.json；浏览器写 localStorage），
 * 保存成功 / 新建 / 打开后清除；下次启动若发现快照则询问恢复。 */
export function useCrashRecovery(): void {
  useEffect(() => {
    void restoreRecoveryIfPresent()
  }, [])

  useEffect(() => {
    return subscribeDirtyRecovery()
  }, [])
}
