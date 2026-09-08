/**
 * DEV-only private example assets. Production builds must not evaluate this
 * module — `file-actions.ts` dynamic-imports it behind `import.meta.env.DEV`
 * so Rollup DCE drops the chunk.
 */
export const privateManifestModules = {
  ...import.meta.glob('@examples/private/index.json', { eager: true, import: 'default' }),
  ...import.meta.glob('@private/examples/index.json', { eager: true, import: 'default' })
} as Record<string, unknown>

export const privateFlowModules = {
  ...import.meta.glob('@examples/private/*.flow.json', { eager: true, import: 'default' }),
  ...import.meta.glob('@private/examples/*.flow.json', { eager: true, import: 'default' })
} as Record<string, unknown>
