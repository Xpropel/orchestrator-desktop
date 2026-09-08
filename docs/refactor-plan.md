# 阶段 6 · 结构重整计划

目标：把三轮并行开发留下的代码收成**一条实现路径、清晰分层、可读命名**。功能冻结期间执行，单人串行，不并行。

## 目标分层（渲染进程）

```
src/renderer/src/
  core/          纯领域层。零 React、零 zustand、零 window：
    schema.ts        算子/参数/变量类型
    registry.ts      注册表（唯一的算子元数据来源）
    library/         builtin.ts · llm.ts · extension.ts（index.ts 合并 public 库 + private/*.ts 扩展）
    graph/           纯图算法：cycle · upstream · containers（归属/坐标换算/级联）· clipboard 重映射 · naming
    variables.ts     引用解析、可用变量、类型兼容、重命名改写
    validate/        rules/*.ts 每条规则一个文件 + index.ts 汇总（同一 code 只出现一次）
    dsl.ts           FlowDocument ⇄ graph（含旧格式迁移，迁移表单独 migrations.ts）
  state/         zustand：flow-store（图 + 历史 + 剪贴板）· validation-store · ui-store（主题/面板开关/选中类别）
  features/      按用户可见功能切分，彼此只通过 state 与 core 交互，不互相 import 组件：
    canvas/          Canvas · nodes/ · edges/ · picker/ · context-menu/ · hooks/
    palette/         Sidebar（类别栏）· OperatorFlyout
    inspector/       PropertyPanel · SchemaForm · fields/ · VariablePicker
    issues/          IssuesPanel
    files/           file-actions · recovery · examples
  platform/      window.api 桥 + 浏览器回退（platform.ts）· debug 挂载（仅 DEV）
  app/           App.tsx · layout/Toolbar · theme · shortcuts（组合根：只做装配）
  ui/            无业务的基础控件
```

主进程同样分层：`main/index.ts` 只做启动装配；`window/`（创建、标题、关闭守卫）、`ipc/`（file · recovery · app）、`menu/`、`security/`（csp · allowed-paths）。

## 硬性规则

1. **一个概念一份实现**。已知重复待合并：算子→节点类型映射、Switch/分类项解析（`form-items` vs 画布侧）、防抖提交、未保存确认对话框（主进程两套）、加节点（`addNode`/`addOperator`/`useAddNode`）。
2. **core 不依赖 React/store/window**；`features` 不互相 import；`app` 只装配。用 `eslint` `no-restricted-imports` 固化边界（本阶段引入 eslint + import 规则，仅此一次新增 devDependency）。
3. **删除而不是保留**：`@deprecated`、`TODO 兼容`、旧 Begin/Switch/Categorize 分支、`window.__orch` 之外的调试挂点、未被引用的导出（用 `tsc --noUnusedLocals` + `knip` 或手工 grep 清一遍）。
4. **命名统一**：文件 kebab-case、组件 PascalCase、hook `use-*.ts`；算子 type 全小写；handle id 只有 `end`/`start`/分支 id/`else`；事件名 `flow:*`。
5. **测试跟着模块走**：`core/**/__tests__`；UI 只保留纯逻辑测试，不写快照。
6. **每一步都可回滚**：按下面顺序推进，每步结束 `typecheck + vitest + build + smoke:examples` 全绿再进下一步。

## 执行顺序

1. 冻结功能，先跑一遍独立审查（重复/死代码/分层违规/命名清单），产出精确到文件与符号的待办。
2. 搬 `core/`（纯移动 + 合并重复），改 import 路径，跑测试。
3. 拆 `state/`：把 flow-store 里的历史、剪贴板、容器操作拆成 slice 文件，公开 API 不变。
4. 拆 `features/`：canvas / palette / inspector / issues / files 各归其位，删除跨 feature import。
5. 主进程分层。
6. 引入 eslint 边界规则 + `npm run lint`，把违规清零。
7. 最终审查 + README / worklog 更新。
