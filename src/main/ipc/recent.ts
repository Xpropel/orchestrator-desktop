import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { allowPath } from '../security/allowed-paths'
import { normalizePath } from '../security/normalize-path'

const MAX_RECENT = 8

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
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .filter((item) => isFlowFile(item) && existsSync(item))
      .slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

export function addRecentFile(filePath: string): void {
  allowPath(filePath)
  const normalized = normalizePath(filePath)
  const next = [filePath, ...getRecentFiles().filter((item) => normalizePath(item) !== normalized)].slice(
    0,
    MAX_RECENT
  )
  writeFileSync(recentFilePath(), JSON.stringify(next, null, 2), 'utf8')
}

export function seedAllowedPaths(paths: string[]): void {
  for (const filePath of paths) {
    if (isFlowFile(filePath) && existsSync(filePath)) {
      allowPath(filePath)
    }
  }
}
