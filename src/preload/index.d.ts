/// <reference types="node" />

export type MenuAction =
  | 'new'
  | 'open'
  | 'save'
  | 'saveAs'
  | 'importJson'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'delete'
  | 'fitView'
  | 'autoLayout'
  /** 打开内置示例，name 对应 `examples/index.json` 中的 `name`。 */
  | `example:${string}`

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

export type SaveResult = 'saved' | 'cancelled' | 'failed'

/** 崩溃恢复快照：未保存的画布内容 + 原文件路径 + 写入时间（ISO）。 */
export interface RecoveryRecord {
  content: string
  filePath: string | null
  savedAt: string
}

export interface Api {
  openFlow(title?: string): Promise<{ filePath: string; content: string } | null>
  saveFlow(filePath: string, content: string): Promise<void>
  saveFlowAs(content: string, defaultName?: string): Promise<string | null>
  readFlow(filePath: string): Promise<{ filePath: string; content: string } | null>
  setDirty(dirty: boolean): void
  /** 同步当前流程标题到窗口标题栏。 */
  setDocumentTitle(title: string): void
  /** 同步当前文件路径（macOS 代理图标 / 文档脏点）。 */
  setFilePath(filePath: string | null): void
  reportSaveResult(result: SaveResult): void
  onMenuAction(cb: (action: MenuAction) => void): () => void
  /** Finder / Dock 打开的 .json；浏览器模式为空操作。 */
  onOpenPath(cb: (filePath: string) => void): () => void
  confirmUnsaved(message?: string): Promise<UnsavedChoice>
  getRecentFiles(): Promise<string[]>
  writeRecovery(record: RecoveryRecord): Promise<void>
  readRecovery(): Promise<RecoveryRecord | null>
  clearRecovery(): Promise<void>
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    api?: Api
  }
}

export {}
