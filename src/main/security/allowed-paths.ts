import { realpathSync } from 'node:fs'
import { normalizePath } from './normalize-path'

export const PATH_NOT_ALLOWED = 'PATH_NOT_ALLOWED'

const allowedPaths = new Set<string>()

function addNormalized(filePath: string): void {
  allowedPaths.add(normalizePath(filePath))
}

function addRealPath(filePath: string): void {
  try {
    addNormalized(realpathSync(filePath))
  } catch {
    // 另存为时文件可能还不存在。
  }
}

export function allowPath(filePath: string): void {
  if (filePath.length === 0) {
    return
  }
  addNormalized(filePath)
  addRealPath(filePath)
}

/**
 * 请求路径必须在白名单内；若磁盘上已有该路径，其实路径也必须在白名单内，
 * 避免打开后被换成指向未授权文件的符号链接。
 */
export function isPathAllowed(filePath: string): boolean {
  if (filePath.length === 0) {
    return false
  }
  if (!allowedPaths.has(normalizePath(filePath))) {
    return false
  }
  try {
    return allowedPaths.has(normalizePath(realpathSync(filePath)))
  } catch {
    return true
  }
}

export function resetAllowedPaths(): void {
  allowedPaths.clear()
}
