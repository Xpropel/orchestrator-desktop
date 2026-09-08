import { resolve } from 'node:path'
import { foldsPathCase } from '../../shared/platform'

/** Windows / macOS 默认盘大小写不敏感，折叠后白名单不会把同一文件当成两条。 */
export function normalizePath(filePath: string): string {
  const resolved = resolve(filePath)
  return foldsPathCase(process.platform) ? resolved.toLowerCase() : resolved
}
