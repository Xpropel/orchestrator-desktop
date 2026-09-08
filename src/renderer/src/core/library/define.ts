import type { OperatorDefinition, ParamField, VariableDef } from '../schema'

export const CONTROL = '#10b981'
export const LOGIC = '#f59e0b'
export const LLM = '#8b5cf6'
export const KNOWLEDGE = '#3b82f6'
export const DATA = '#06b6d4'
export const INTEGRATION = '#14b8a6'
export const INTERACTION = '#ec4899'
export const MISC = '#94a3b8'

export function op(
  type: string,
  title: string,
  description: string,
  icon: string,
  color: string,
  category: string,
  kind: OperatorDefinition['kind'],
  params: ParamField[],
  outputs: VariableDef[],
  extra?: Pick<OperatorDefinition, 'scopeVariables' | 'constraints'>
): OperatorDefinition {
  return { type, title, description, icon, color, category, kind, params, outputs, ...extra }
}
