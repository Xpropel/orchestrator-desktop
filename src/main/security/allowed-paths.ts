import { normalizePath } from './normalize-path'

export const PATH_NOT_ALLOWED = 'PATH_NOT_ALLOWED'

const allowedPaths = new Set<string>()

export function allowPath(filePath: string): void {
  if (filePath.length === 0) {
    return
  }
  allowedPaths.add(normalizePath(filePath))
}

export function isPathAllowed(filePath: string): boolean {
  return allowedPaths.has(normalizePath(filePath))
}
