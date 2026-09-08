/// <reference types="vite/client" />

import type { runMenuAction } from './app/menu-actions'
import type { runAutoLayout } from './features/canvas/run-auto-layout'
import type { importJson, importJsonFromText } from './features/files/file-actions'
import type { normalizeImportedJson } from './features/files/import-json'
import type { fileApi } from './platform/platform'
import type {
  documentToGraph,
  graphToDocument,
  parseDocument,
  serializeDocument
} from './core/dsl'
import type { useFlowStore } from './state/flow-store'

declare global {
  interface Window {
    __orch?: {
      useFlowStore: typeof useFlowStore
      graphToDocument: typeof graphToDocument
      documentToGraph: typeof documentToGraph
      parseDocument: typeof parseDocument
      serializeDocument: typeof serializeDocument
      runAutoLayout: typeof runAutoLayout
      runMenuAction: typeof runMenuAction
      fileApi: typeof fileApi
      importJson: typeof importJson
      importJsonFromText: typeof importJsonFromText
      normalizeImportedJson: typeof normalizeImportedJson
    }
  }
}

export {}

