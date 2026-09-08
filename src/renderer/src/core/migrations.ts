import { hasOperator } from './registry'

const LEGACY_LABEL_MAP: Record<string, string> = {
  Begin: 'start',
  Agent: 'agent',
  Retrieval: 'retrieval',
  Message: 'message',
  Switch: 'switch',
  Categorize: 'classifier',
  Iteration: 'foreach',
  Code: 'code',
  HttpRequest: 'http',
  Condition: 'if',
  Note: 'note',
  Custom: 'custom'
}

export function migrateLabel(label: string): string {
  return LEGACY_LABEL_MAP[label] ?? label
}

export function resolveOperatorType(label: string): string {
  const migrated = migrateLabel(label)
  if (hasOperator(migrated)) return migrated
  return 'custom'
}
