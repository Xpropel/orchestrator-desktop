export type VarType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file' | 'session' | 'any'
// 'session' = 模型会话上下文句柄，见 2.1

export type NodeKind =
  | 'start' // 入口节点，无输入端口，可有多个
  | 'end' // 终点，无输出端口
  | 'task' // 普通任务：1 入 1 出
  | 'branch' // 分支：1 入，多出（出口由 form 动态生成，外加可选 else）
  | 'container' // 循环容器：1 入 1 出，内部可放子节点（ForEach / While）
  | 'loopStart' // 容器内部起点，随容器自动创建，不可单独删除/复制
  | 'break' // 只能放在容器内部，跳出循环，无输出端口
  | 'note' // 便签，无端口，不参与执行

export interface VariableDef {
  name: string // 变量名（同一算子内唯一）
  type: VarType
  description?: string
}

export type ParamFieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'slider'
  | 'code' // 代码编辑，extra: { language?: string }
  | 'json' // JSON 对象编辑（整表替换）
  | 'expression' // 布尔/值表达式，可内嵌 {{变量}}
  | 'template' // 多行文本，可内嵌 {{变量}}（Prompt、消息正文）
  | 'variable' // 选择一个上游变量，值形如 "{{Node_1.output}}"，extra: { accept?: VarType[] }
  | 'stringList' // 字符串标签列表
  | 'keyValue' // 键值对列表 -> Record<string,string>
  | 'cases' // 分支条件列表（Switch/If）：{ id, label, expression }[]
  | 'categories' // 分类列表（Classifier）：{ id, name, description }[]
  | 'inputs' // 入参声明列表（Start）：{ key, type: VarType, required, description }[]
  | 'assignments' // 变量赋值列表：{ variable, value }[]
  | 'model' // 模型选择，值为模型 id 字符串

export interface ParamField {
  key: string
  label: string
  type: ParamFieldType
  default?: unknown
  required?: boolean
  hint?: string
  placeholder?: string
  options?: { label: string; value: string | number }[] // select
  min?: number
  max?: number
  step?: number // number / slider
  extra?: Record<string, unknown>
  showWhen?: { key: string; equals: unknown } // 条件显示
}

export interface OperatorDefinition {
  type: string // 唯一键，如 'llm' | 'http' | 'foreach'
  title: string
  description: string
  icon: string // lucide 图标名（PascalCase），运行时经 icon 表解析
  color: string
  category: string // 对应 OperatorCategory.key
  kind: NodeKind
  params: ParamField[]
  outputs: VariableDef[] // 该节点向下游暴露的变量
  /** container 专用：循环体内可用的变量（如 item / index） */
  scopeVariables?: VariableDef[]
  constraints?: {
    maxInstances?: number
    deletable?: boolean
    onlyInsideContainer?: boolean // break = true
    hasElseBranch?: boolean // branch 专用
    hidden?: boolean // 不在侧栏/选择器中显示（loop-start = true）
    /** 允许没有上游边：本身就是数据/流程的起点（start、dataset），可达性检查把它当作根 */
    allowRoot?: boolean
    /** 输出变量由该 `inputs` 类型参数动态派生（start = 'inputs'，dataset = 'fields'），而非 `outputs` 静态声明 */
    outputsFromParam?: string
  }
}

export interface OperatorCategory {
  key: string
  title: string
  order: number
  /** 专属/项目类别：侧栏置底并高亮 */
  exclusive?: boolean
  /** lucide 图标名（PascalCase），缺省时回退 palette 白名单 */
  icon?: string
  /** 侧栏/飞出面板高亮色 */
  accent?: string
  /** Every operator in this category calls this preset model (node badge / resolveNodeModel). */
  model?: { provider: 'deepseek' | 'qwen'; name: string }
}

export interface OperatorLibrary {
  version: 1
  categories: OperatorCategory[]
  operators: OperatorDefinition[]
}

export interface CaseItem {
  id: string
  label: string
  expression: string
}

export interface CategoryItem {
  id: string
  name: string
  description: string
}

export interface InputItem {
  id?: string
  key: string
  type: VarType
  required: boolean
  description: string
}

export interface AssignmentItem {
  id: string
  variable: string
  value: string
}

export interface KeyValueItem {
  id: string
  key: string
  value: string
}

export const VAR_TYPES: readonly VarType[] = [
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'file',
  'session',
  'any'
]

export function isVarType(value: unknown): value is VarType {
  return typeof value === 'string' && (VAR_TYPES as readonly string[]).includes(value)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
