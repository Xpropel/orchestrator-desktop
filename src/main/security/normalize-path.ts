import { resolve } from 'node:path'

/** Windows 折叠大小写，避免同一文件两种写法被白名单拒掉。 */
export function normalizePath(filePath: string): string {
  const resolved = resolve(filePath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}
