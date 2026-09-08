import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { allowPath } from '../security/allowed-paths'
import { normalizePath } from '../security/normalize-path'

export const MAX_RECENT = 8

function recentFilePath(): string {
  return join(app.getPath('userData'), 'recent.json')
}

function isFlowFile(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return lower.endsWith('.flow.json') || lower.endsWith('.json')
}

export function getRecentFiles(): string[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(recentFilePath(), 'utf8'))
    if (!Array.isArray(parsed)) {
      return []
    }
    const seen = new Set<string>()
    const next: string[] = []
    for (const item of parsed) {
      if (typeof item !== 'string' || !isFlowFile(item) || !existsSync(item)) {
        continue
      }
      const key = normalizePath(item)
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      next.push(item)
      if (next.length >= MAX_RECENT) {
        break
      }
    }
    return next
  } catch {
    return []
  }
}

export function addRecentFile(filePath: string): void {
  allowPath(filePath)
  try {
    const normalized = normalizePath(filePath)
    const next = [filePath, ...getRecentFiles().filter((item) => normalizePath(item) !== normalized)].slice(
      0,
      MAX_RECENT
    )
    writeFileSync(recentFilePath(), JSON.stringify(next, null, 2), 'utf8')
  } catch {
    // 最近列表写失败不能让已经成功的打开/保存 IPC 失败。
  }
}

export function seedAllowedPaths(paths: string[]): void {
  for (const filePath of paths) {
    if (isFlowFile(filePath) && existsSync(filePath)) {
      allowPath(filePath)
    }
  }
}
