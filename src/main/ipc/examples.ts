import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'

/** 原生菜单「打开示例」需要的最小信息；完整示例内容由渲染进程随包携带。 */
export interface ExampleMenuEntry {
  name: string
  title: string
}

function isExampleMenuEntry(value: unknown): value is ExampleMenuEntry {
  if (!value || typeof value !== 'object') {
    return false
  }
  const entry = value as Record<string, unknown>
  return typeof entry.name === 'string' && typeof entry.title === 'string'
}

async function readManifest(rel: string): Promise<ExampleMenuEntry[]> {
  try {
    const raw: unknown = JSON.parse(await readFile(join(app.getAppPath(), rel), 'utf8'))
    if (!Array.isArray(raw)) {
      return []
    }
    return raw.filter(isExampleMenuEntry).map(({ name, title }) => ({ name, title }))
  } catch {
    return []
  }
}

/** 读取公开清单，再合并 gitignore / 私有子模块里的可选清单。 */
export async function loadExampleManifest(): Promise<ExampleMenuEntry[]> {
  const publicEntries = await readManifest(join('examples', 'index.json'))
  const privateEntries = [
    ...(await readManifest(join('examples', 'private', 'index.json'))),
    ...(await readManifest(join('private', 'examples', 'index.json')))
  ]
  const seen = new Set(publicEntries.map((entry) => entry.name))
  const extra: ExampleMenuEntry[] = []
  for (const entry of privateEntries) {
    if (seen.has(entry.name)) continue
    seen.add(entry.name)
    extra.push(entry)
  }
  return [...publicEntries, ...extra]
}
