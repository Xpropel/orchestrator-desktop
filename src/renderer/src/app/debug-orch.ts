import { runMenuAction } from '@/app/menu-actions'
import { runAutoLayout } from '@/features/canvas/run-auto-layout'
import { importJson, importJsonFromText } from '@/features/files/file-actions'
import { normalizeImportedJson } from '@/features/files/import-json'
import { fileApi } from '@/platform/platform'
import { documentToGraph, graphToDocument, parseDocument, serializeDocument } from '@/core/dsl'
import { useFlowStore } from '@/state/flow-store'

export function attachOrchDebug(): void {
  window.__orch = {
    useFlowStore,
    graphToDocument,
    documentToGraph,
    parseDocument,
    serializeDocument,
    runAutoLayout,
    runMenuAction,
    fileApi,
    importJson,
    importJsonFromText,
    normalizeImportedJson
  }
}
