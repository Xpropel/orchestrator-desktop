import { registerLibrary } from '../registry'
import type { OperatorCategory, OperatorDefinition, OperatorLibrary } from '../schema'
import { BUILTIN_CATEGORIES, BUILTIN_OPERATORS } from './builtin'
import type { ExtensionRule, GlobalsSection, LibraryExtension } from './extension'
import { LLM_OPERATORS } from './llm'

export type { ExtensionRule, ExtensionRuleContext, GlobalsSection, LibraryExtension } from './extension'

export const builtinLibrary: OperatorLibrary = {
  version: 1,
  categories: [...BUILTIN_CATEGORIES],
  operators: [...BUILTIN_OPERATORS, ...LLM_OPERATORS]
}

export function mergeExtensions(list: LibraryExtension[]): {
  categories: OperatorCategory[]
  operators: OperatorDefinition[]
  rules: ExtensionRule[]
  globals: GlobalsSection[]
} {
  return {
    categories: list.flatMap((item) => item.categories),
    operators: list.flatMap((item) => item.operators),
    rules: list.flatMap((item) => item.rules ?? []),
    globals: list.flatMap((item) => item.globals ?? [])
  }
}

function isLibraryExtension(value: unknown): value is LibraryExtension {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<LibraryExtension>
  return Array.isArray(item.categories) && Array.isArray(item.operators)
}

function readDiscoveredExtensions(): LibraryExtension[] {
  const modules = import.meta.glob('./private/*.ts', { eager: true }) as Record<
    string,
    { default?: unknown }
  >
  const list: LibraryExtension[] = []
  for (const [path, mod] of Object.entries(modules)) {
    if (!mod || mod.default === undefined) {
      console.warn(`[library] ${path} has no default export; ignored`)
      continue
    }
    if (!isLibraryExtension(mod.default)) {
      console.warn(`[library] ${path} default export is not a LibraryExtension; ignored`)
      continue
    }
    list.push(mod.default)
  }
  return list
}

const discovered = mergeExtensions(readDiscoveredExtensions())

export function getExtensionRules(): ExtensionRule[] {
  return discovered.rules
}

export function getExtensionGlobals(): GlobalsSection[] {
  return discovered.globals
}

export function loadLibrary(): void {
  registerLibrary({
    version: 1,
    categories: [...builtinLibrary.categories, ...discovered.categories],
    operators: [...builtinLibrary.operators, ...discovered.operators]
  })
}
