# Phase 5 规格：通用组件库 · 变量数据流 · 逻辑校验 · 循环容器 · 主题

本文件是阶段 5 两支并行工程队的共同契约。命名、字段、文件所有权以本文为准；有分歧先改本文再改代码。

## 0. 产品定位

一个**独立、通用、只读写 JSON 文件**的可视化工作流/智能体编排桌面工具（Electron）。
布局：左侧两级组件面板 → 中间 React Flow 画布 → 点选节点后出现的**悬浮属性面板**（`features/inspector/floating-inspector.tsx`，可拖动 / 拉宽 / 拉高 / 折叠，不占整栏）；底部「问题」面板。
组件集合不再写死，改为**数据驱动的算子注册表**（schema），悬浮面板按 schema 自动渲染。

## 1. 算子定义 schema（`src/renderer/src/core/schema.ts`）

```ts
export type VarType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file' | 'session' | 'any'
// 'session' = 模型会话上下文句柄，见 2.1

export type NodeKind =
  | 'start'      // 唯一入口，无输入端口
  | 'end'        // 终点，无输出端口
  | 'task'       // 普通任务：1 入 1 出
  | 'branch'     // 分支：1 入，多出（出口由 form 动态生成，外加可选 else）
  | 'container'  // 循环容器：1 入 1 出，内部可放子节点（ForEach / While）
  | 'loopStart'  // 容器内部起点，随容器自动创建，不可单独删除/复制
  | 'break'      // 只能放在容器内部，跳出循环，无输出端口
  | 'note'       // 便签，无端口，不参与执行

export interface VariableDef {
  name: string            // 变量名（同一算子内唯一）
  type: VarType
  description?: string
}

export type ParamFieldType =
  | 'string' | 'text' | 'number' | 'boolean' | 'select' | 'slider'
  | 'code'        // 代码编辑，extra: { language?: string }
  | 'json'        // JSON 对象编辑（整表替换）
  | 'expression'  // 布尔/值表达式，可内嵌 {{变量}}
  | 'template'    // 多行文本，可内嵌 {{变量}}（Prompt、消息正文）
  | 'variable'    // 选择一个上游变量，值形如 "{{Node_1.output}}"，extra: { accept?: VarType[] }
  | 'stringList'  // 字符串标签列表
  | 'keyValue'    // 键值对列表 -> Record<string,string>
  | 'cases'       // 分支条件列表（Switch/If）：{ id, label, expression }[]
  | 'categories'  // 分类列表（Classifier）：{ id, name, description }[]
  | 'inputs'      // 入参声明列表（Start）：{ key, type: VarType, required, description }[]
  | 'assignments' // 变量赋值列表：{ variable, value }[]

export interface ParamField {
  key: string
  label: string
  type: ParamFieldType
  default?: unknown
  required?: boolean
  hint?: string
  placeholder?: string
  options?: { label: string; value: string | number }[]  // select
  min?: number; max?: number; step?: number              // number / slider
  extra?: Record<string, unknown>
  showWhen?: { key: string; equals: unknown }            // 条件显示
}

export interface OperatorDefinition {
  type: string                 // 唯一键，如 'llm' | 'http' | 'foreach'
  title: string
  description: string
  icon: string                 // lucide 图标名（PascalCase），运行时经 icon 表解析
  color: string
  category: string             // 对应 OperatorCategory.key
  kind: NodeKind
  params: ParamField[]
  outputs: VariableDef[]       // 该节点向下游暴露的变量
  /** container 专用：循环体内可用的变量（如 item / index） */
  scopeVariables?: VariableDef[]
  constraints?: {
    maxInstances?: number      // 如 start = 1
    deletable?: boolean        // start = false
    onlyInsideContainer?: boolean   // break = true
    hasElseBranch?: boolean         // branch 专用
    hidden?: boolean                // 不在侧栏/选择器中显示（loop-start = true）
  }
}

export interface OperatorCategory {
  key: string
  title: string
  order: number
}

export interface OperatorLibrary {
  version: 1
  categories: OperatorCategory[]
  operators: OperatorDefinition[]
}
```

注册表 API（`src/renderer/src/core/registry.ts`）：
`registerLibrary(lib: OperatorLibrary)`、`getOperator(type): OperatorDefinition`（未知类型抛错，不再回退）、
`listOperators()`、`listCategories()`、`getDefaultForm(type): Record<string, unknown>`、
`getNodeTypeForKind(kind): FlowNodeType`。内置库在 `src/renderer/src/core/library/`（`builtin.ts` + `llm.ts`），由 `loadLibrary()` 在启动时 `registerLibrary`；可选扩展由 `import.meta.glob('./private/*.ts')` 合并。

## 2. 内置通用组件库（builtin-library）

分类与算子（type 全小写 kebab）：

| 分类 key | 标题 | 算子 type（kind） |
|---|---|---|
| `control` | 开始 / 结束 | `start`(start) · `end`(end) |
| `logic` | 逻辑控制 | `if`(branch, cases + else) · `switch`(branch, cases + else) · `foreach`(container) · `while`(container) · `loop-start`(loopStart，容器内部起点，`constraints.hidden = true` 不在面板显示，随容器自动创建) · `break`(break) · `wait`(task, 延时) · `merge`(task, 多入合并) |
| `llm` | 大模型 | `agent`(task, LLM 调用主力) · `session`(task, 创建模型会话) · `session-fork`(task, 分叉会话上下文) · `prompt-template`(task) · `classifier`(branch, categories) · `parameter-extractor`(task) |
| `knowledge` | 知识 | `retrieval`(task) · `document-parser`(task) |
| `data` | 数据处理 | `dataset`(task, 初始数据集，fields 派生输出) · `code`(task) · `set-variable`(task, assignments) · `variable-aggregator`(task) · `transform`(task, JSONPath/模板) · `list-operation`(task) · `text-operation`(task) |
| `integration` | 集成 | `http`(task) · `webhook`(task) · `sql`(task) · `file-read`(task) · `file-write`(task) · `email`(task) |
| `interaction` | 交互 | `message`(task, 输出消息) · `human-input`(task, 等待人工填写) · `approval`(branch, 通过/拒绝) |
| `misc` | 其他 | `subflow`(task, 调用另一 JSON 流程) · `custom`(task, json 参数) · `note`(note) |

每个算子必须给出 `params`、`outputs`（如 `agent.outputs = [{name:'text',type:'string'}, {name:'session',type:'session'}, {name:'usage',type:'object'}]`；`http.outputs = [{status,number},{body,any},{headers,object}]`；`foreach.scopeVariables = [{item,any},{index,number}]`，`foreach.outputs = [{results,array}]`；`while.scopeVariables = [{index,number}]`；`start.outputs` 由其 `inputs` 参数动态派生；`classifier.outputs = [{category,string}]`）。

## 2.1 LLM 类别设计：模型会话与上下文复用（重点）

`agent` 仍是 LLM 调用的唯一主力节点，**不再增加其他调用变体**。LLM 类别的价值在于把"模型会话上下文"做成一等公民，
让多个节点复用同一份已建立的上下文（省 token、命中供应商前缀缓存），并能在任意时点**fork** 出副本各走各的。

### 核心概念：Session（模型会话）

```ts
// 新增变量类型
export type VarType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file' | 'session' | 'any'

// 运行时语义（编排工具只负责声明与校验，不执行）
export interface SessionSpec {
  id: string                       // 会话 id，运行时生成
  provider: string                 // openai | anthropic | ollama | azure | custom
  model: string
  baseUrl?: string
  apiKeyRef?: string               // 环境变量名/密钥别名，绝不落盘明文
  temperature?: number
  maxTokens?: number
  system?: string                  // 系统提示词，随会话固定
  keepAlive: boolean               // 保持模型上下文常驻（KV/前缀缓存），跨节点复用
  cacheTtlSeconds?: number         // 常驻上下文的存活时间
  historyWindow?: number           // 保留最近 N 轮，0 = 全部
}
```

一条会话在图中以 `{{Session_1.session}}` 这样的变量流动；任何 `agent` 都可以「挂到」一个会话上，调用后上下文累积在该会话里。

### 节点职责

| type | kind | 关键 params | outputs | 说明 |
|---|---|---|---|---|
| `session` | task | `provider`(select) · `model`(string) · `baseUrl`(string) · `apiKeyRef`(string) · `system`(template) · `temperature`(slider) · `maxTokens`(number) · `keepAlive`(boolean, 默认 true) · `cacheTtlSeconds`(number, showWhen keepAlive) · `historyWindow`(number) | `session:session` | 创建一条模型会话；同一会话可被多个 agent 依次复用，避免重复传上下文 |
| `session-fork` | task | `source`(variable, accept ['session']) · `label`(string) · `inheritHistory`(boolean, 默认 true) · `truncateToTurn`(number, 可选：只继承前 N 轮) | `session:session` | 从现有会话**分叉**一个副本：共享到此刻为止的上下文（含已缓存前缀），之后的对话互不影响。用于「从同一上下文出发探索多条路线」 |
| `agent` | task | `session`(variable, accept ['session']，可选) · `model`(string, 未挂会话时必填) · `system`(template, 未挂会话时可用) · `prompt`(template) · `tools`(stringList) · `maxSteps`(number) · `structuredOutput`(json, 可选) | `text:string` · `json:object` · `session:session` · `usage:object` | 挂到会话则续写该会话上下文并把更新后的会话继续向下游传；不挂则临时会话（一次性） |
| `prompt-template` | task | `template`(template) | `text:string` | 组装提示词片段，供 agent 引用 |
| `classifier` | branch | `session`(variable, 可选) · `input`(variable) · `categories`(categories) | `category:string` | 分类分支 |
| `parameter-extractor` | task | `session`(variable, 可选) · `input`(variable) · `schema`(json) | `params:object` | 结构化抽取 |

### 典型编排

```
Start → Session_1 ─→ Agent_1(挂 Session_1，先读文档建立上下文)
                       ├─→ SessionFork_A → Agent_2(路线 A：总结)
                       └─→ SessionFork_B → Agent_3(路线 B：抽取要点)
```

Agent_2 / Agent_3 都无需重传文档，供应商侧前缀缓存命中；两条路线的后续对话互不污染。

### 校验补充规则

- `SESSION_TYPE_MISMATCH`：`session` 字段引用的变量类型不是 `session`（error）。
- `SESSION_NOT_UPSTREAM`：引用的会话不在当前节点上游（error，由通用 `REFERENCE_NOT_UPSTREAM` 覆盖，单独给出更友好的提示）。
- `AGENT_NO_MODEL`：agent 既未挂会话也未填 `model`（error）。
- `FORK_UNUSED`：`session-fork` 的输出没有任何下游引用（warning）。
- `SESSION_CONCURRENT_WRITE`：同一会话被两条**并行**分支（同一分叉点之后的不同出口）各自续写，提示应先 fork（warning）。

## 3. 节点数据与 React Flow 类型

```ts
export interface BaseNodeData extends Record<string, unknown> {
  label: string          // = OperatorDefinition.type
  name: string           // 画布唯一显示名，引用变量时使用
  description?: string
  form: Record<string, unknown>
}
export type FlowNodeType =
  | 'startNode' | 'endNode' | 'taskNode' | 'branchNode'
  | 'containerNode' | 'loopStartNode' | 'breakNode' | 'noteNode'
```

- `label` 从 `OperatorType` 联合改为 `string`（由注册表校验）。
- 容器子节点：React Flow 原生 `parentId`，子节点 `position` 相对父节点。**不设 `extent: 'parent'`**（实现决定：设了就无法把节点拖出容器；归属改由 `onNodeDragStop` 的几何判定维护）。
- 容器新建时自动创建 `loopStartNode` 子节点（id `${containerId}:start`）。
- Handle id：入口固定 `end`；出口固定 `start`；branch 出口 = `case.id` / `category.id`，else = `else`；approval 出口 `approved` / `rejected`。

## 4. 变量引用与数据流

- 语法：`{{NodeName.variable}}`；全局：`{{sys.query}}`、`{{sys.files}}`、`{{sys.now}}`、`{{start.<inputKey>}}`。
- 引用按**节点名**存储；重命名节点时 store 经 `renameReferencesInGraph` 改写全图引用；校验强制名称唯一。
- 可用变量 = 沿边**向上游**可达的所有节点的 `outputs` + 全局 + 所在容器链的 `scopeVariables`（容器内节点可用容器的 item/index）
  + **所在容器自身的上游节点的 `outputs`**（容器内节点要能引用容器外、连到容器之前的结果；RAGFlow 同此规则）。
- 容器节点自身对外暴露的 `outputs`（如 foreach 的 `results`）只对容器**下游**可见，对容器内部不可见。
- 工具函数（`src/renderer/src/core/variables.ts`）：
  `parseReferences(text): { raw, node, variable }[]`、`getUpstreamNodeIds(nodeId, nodes, edges)`、
  `getAvailableVariables(nodeId, nodes, edges): { nodeId, nodeName, variable: VariableDef, scope: 'upstream'|'global'|'container' }[]`、
  `isTypeCompatible(actual, accept[])`、`renameReferencesInForm(form, oldName, newName)`。
- 属性面板：`variable` 字段用下拉选择器；`template`/`expression` 字段旁有「插入变量」按钮弹出同一选择器。

## 5. 逻辑连贯性校验（`src/renderer/src/core/validate/`）

```ts
export type IssueLevel = 'error' | 'warning'
export interface FlowIssue {
  id: string; level: IssueLevel; code: string; message: string
  nodeId?: string; edgeId?: string; field?: string
}
export function validateFlow(nodes, edges): FlowIssue[]
```

规则（code）：
`NO_START`/`MULTI_START`、`UNREACHABLE`（从 start 不可达，warning；note 除外）、`DEAD_END`（task 无出边且非 end，warning）、
`MISSING_REQUIRED`（required 参数为空，error）、`UNKNOWN_REFERENCE`（引用的节点/变量不存在，error）、
`REFERENCE_NOT_UPSTREAM`（引用了不在上游的节点，error）、`TYPE_MISMATCH`（variable 字段类型不兼容，error）、
`DUPLICATE_NAME`、`EMPTY_CONTAINER`（容器无子节点，warning）、`BREAK_OUTSIDE_LOOP`、`WHILE_NO_CONDITION`、
`FOREACH_ITEMS_NOT_ARRAY`、`BRANCH_NO_TARGET`（某 case 无出边，warning）、`CROSS_CONTAINER_EDGE`、`CYCLE`（容器外成环）。
校验在 nodes/edges/form 变化后 300ms 防抖执行，结果放 `state/validation-store.ts`；
底部「问题」面板列出并可点击定位节点；节点右上角红/黄圆点徽标显示问题数。

## 6. 容器（ForEach / While）画布行为

- 容器节点 `containerNode`：可 `NodeResizer`（最小 360×220），内部有标题栏 + 虚线区域；`loopStartNode` 固定在左上。
- 从侧栏拖入或拖动节点到容器内部区域 → 自动设 `parentId` 并把坐标换算为相对坐标；拖出容器 → 清 `parentId`（用 `getIntersectingNodes` 在 `onNodeDragStop` 判定）。
- 禁止容器嵌套容器（阶段 5）；禁止跨容器边界连线；`break` 只能落在容器内。
- 删除容器级联删除子节点（`loopStartNode` 不可单独删除/复制）；复制容器连子节点一起复制（id 重映射，`parentId` 同步）。
- 容器内新建节点（从容器内节点右键/拖线追加）自动继承 `parentId`。
- DSL：子节点在 `components` 中**平铺**为独立条目并带 `parent_id: containerId`（与 RAGFlow 字段名一致）；
  容器的 `downstream` 表示循环结束后的出口；容器内部起点 = `parent_id` 等于容器且 kind 为 `loopStart` 的节点。
- 与 RAGFlow 的差异（有意为之）：RAGFlow 不支持把节点拖入/拖出容器（只能从容器内节点追加），我们支持；RAGFlow 无图级校验，我们有。

## 7. 主题

`src/renderer/src/state/theme-store.ts` 存模式/强调色，`src/renderer/src/app/theme.ts` 负责 `initTheme` / DOM token：`dark` / `light` 两套 token（沿用现有 CSS 变量）+ 强调色预设（blue / violet / emerald / amber）；
`localStorage` 持久化；Toolbar 右侧切换按钮；React Flow 的 Background / MiniMap / Controls 跟随主题。

## 8. 文件所有权（已作废）

阶段 5 的 A/B 队目录所有权已随阶段 6 结构重整作废。当前以分层规则为准，见 `docs/refactor-plan.md`（目标分层与硬性规则）与 `docs/refactor-audit.md`（施工清单与 eslint 边界）。代码落在 `core/`、`state/`、`features/`、`app/`、`platform/`、`ui/`、`shared/`，不再按并行队伍切地盘。

## 9. 左侧组件面板：两级结构（替换现有平铺列表）

现状是把所有算子平铺罗列，改为**类别 → 工具**两级：

1. **一级：类别栏**。Sidebar 收窄为 ~200px，只列类别（图标 + 中文标题 + 该类工具数量徽标），顶部保留搜索框；搜索有输入时退化为跨类别的平铺结果列表（命中项显示所属类别）。
2. **二级：工具飞出面板（Flyout）**。点击某类别 → 紧挨 Sidebar 右侧弹出一个 280px 面板，列出该类下的工具（图标 / 标题 / 一行描述），可点击添加、可拖拽到画布。再次点击同一类别或点击画布空白 / Esc 关闭；点击另一类别切换内容。当前选中类别高亮。
3. **拖拽整个类别到画布**：类别行本身 `draggable`，`dataTransfer` MIME `application/orchestrator-category`。画布 `onDrop` 收到类别时，在落点弹出**工具选择器 Popover**（列出该类工具，支持键入过滤，↑↓ 选择，Enter 确认，Esc 取消）；选中后在落点创建节点，取消则不创建。
4. **从连接点拖线到空白处**同样弹出工具选择器（此时列出全部类别 → 工具的两级菜单），选中后创建节点并自动连线（对齐 RAGFlow 的 NextStepDropdown 体验）。
5. 组件 `features/canvas/operator-picker.tsx` 是上述 3、4 共用的选择器；Sidebar 与 Flyout 在 `features/palette/sidebar.tsx`、`features/palette/operator-flyout.tsx`。
6. 类别顺序取 `OperatorCategory.order`；`exclusive: true` 的专属/项目类别置于所有通用类别之后，并用 `accent` / `icon` 高亮（不写死某个类别 key）。
