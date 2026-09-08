import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Companion submodule files live at `private/library/*.ts` but were authored
 * as if they sat in `src/renderer/src/core/library/private/`. Rewrite those
 * relative imports so local builds with the submodule keep working.
 */
export function privateLibraryResolve(root = process.cwd()): Plugin {
  const map: Record<string, string> = {
    '../define': resolve(root, 'src/renderer/src/core/library/define.ts'),
    '../extension': resolve(root, 'src/renderer/src/core/library/extension.ts'),
    '../../schema': resolve(root, 'src/renderer/src/core/schema.ts'),
    '../../variables': resolve(root, 'src/renderer/src/core/variables.ts'),
    '../../validate/helpers': resolve(root, 'src/renderer/src/core/validate/helpers.ts'),
    '../../validate/issue': resolve(root, 'src/renderer/src/core/validate/issue.ts')
  }

  return {
    name: 'private-library-resolve',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer) {
        return
      }
      const path = importer.replaceAll('\\', '/')
      if (!path.includes('/private/library/')) {
        return
      }
      return map[id]
    }
  }
}
