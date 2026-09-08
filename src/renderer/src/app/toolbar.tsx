import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from 'react'
import { AlertTriangle, Download, FilePlus, FolderOpen, Moon, Save, Sun, Timer, Upload } from 'lucide-react'
import { ACTION_LABEL } from '@shared/action-labels'
import { exportJson, importJson, newFlow, openFlow, saveFlow, saveFlowAs } from '@/features/files/file-actions'
import { ExamplesMenu } from '@/features/files/examples-menu'
import { RecentFilesMenu } from '@/features/files/recent-files-menu'
import { ACCENT_HEX, ACCENT_PRESETS, useThemeStore, type AccentPreset } from '@/state/theme-store'
import {
  AUTOSAVE_INTERVALS,
  useSettingsStore,
  type AutosaveIntervalSec
} from '@/state/settings-store'
import { isElectron } from '@/platform/platform'
import { cn } from '@/ui/cn'
import { Input } from '@/ui/input'
import { ToolButton } from '@/ui/tool-button'
import { useValidationStore } from '@/state/validation-store'
import { useFlowStore } from '@/state/flow-store'
import { useUiStore } from '@/state/ui-store'

function fileLabel(filePath: string | null, title: string): string {
  if (!filePath) {
    return `${title}.flow.json`
  }
  return filePath.split(/[/\\]/).pop() ?? filePath
}

export function Toolbar(): JSX.Element {
  const title = useFlowStore((state) => state.title)
  const filePath = useFlowStore((state) => state.filePath)
  const dirty = useFlowStore((state) => state.dirty)
  const nodeCount = useFlowStore((state) => state.nodes.length)
  const edgeCount = useFlowStore((state) => state.edges.length)
  const setTitle = useFlowStore((state) => state.setTitle)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(title)
  const issues = {
    error: useValidationStore((state) => state.errorCount),
    warning: useValidationStore((state) => state.warningCount)
  }
  const issuesOpen = useUiStore((state) => state.issuesPanelOpen)
  const toggleIssues = useUiStore((state) => state.toggleIssuesPanel)
  const lastAutosaveAt = useSettingsStore((state) => state.lastAutosaveAt)

  const commitTitle = (): void => {
    const next = titleDraft.trim() || 'Untitled'
    if (next !== title) {
      setTitle(next)
    }
    setEditingTitle(false)
  }

  return (
    // 悬浮在画布顶部、背景透明；三组之间的空白不拦截指针，画布仍可从那里拖动。
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-toolbar items-center justify-between gap-2 px-2">
      <div className="pointer-events-auto flex min-w-0 items-center gap-0.5">
        <ToolButton onClick={() => void newFlow()}>
          <FilePlus className="h-3.5 w-3.5" />
          {ACTION_LABEL.new}
        </ToolButton>
        <div className="flex items-center">
          <ToolButton onClick={() => void openFlow()}>
            <FolderOpen className="h-3.5 w-3.5" />
            {ACTION_LABEL.open}
          </ToolButton>
          {isElectron() ? <RecentFilesMenu /> : null}
        </div>
        <ExamplesMenu />
        <span className="mx-1 h-3.5 w-px bg-border" />
        <ToolButton onClick={() => void saveFlow()}>
          <Save className="h-3.5 w-3.5" />
          {ACTION_LABEL.save}
        </ToolButton>
        <ToolButton onClick={() => void saveFlowAs()}>{ACTION_LABEL.saveAs}</ToolButton>
        <AutosaveMenu />
        <span className="mx-1 h-3.5 w-px bg-border" />
        <ToolButton onClick={exportJson}>
          <Download className="h-3.5 w-3.5" />
          {ACTION_LABEL.exportJson}
        </ToolButton>
        <ToolButton onClick={() => void importJson()}>
          <Upload className="h-3.5 w-3.5" />
          {ACTION_LABEL.importJson}
        </ToolButton>
      </div>

      <div className="pointer-events-auto flex min-w-0 flex-1 items-center justify-center gap-2 text-[11px] text-secondary">
        {editingTitle ? (
          <Input
            autoFocus
            className="h-6 max-w-[240px] text-center text-xs"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitTitle()
              }
              if (event.key === 'Escape') {
                setTitleDraft(title)
                setEditingTitle(false)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="max-w-[280px] truncate text-[13px] font-medium text-primary hover:text-accent"
            title={filePath ? `${filePath}（点击编辑标题）` : '点击编辑标题'}
            onClick={() => {
              setTitleDraft(title)
              setEditingTitle(true)
            }}
          >
            {title}
            {dirty ? <span className="ml-0.5 text-accent">*</span> : null}
          </button>
        )}
        {filePath ? <span className="hidden max-w-[220px] truncate lg:inline">{fileLabel(filePath, title)}</span> : null}
        {lastAutosaveAt ? <span className="hidden xl:inline">自动保存 {formatClock(lastAutosaveAt)}</span> : null}
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-secondary">
        <span className="px-1">
          {nodeCount} 节点 · {edgeCount} 边
        </span>
        <ToolButton
          aria-label="问题面板"
          onClick={toggleIssues}
          data-testid="issues-toggle"
          active={issuesOpen}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          问题
          {issues.error > 0 ? <span className="text-red-400">{issues.error}</span> : null}
          {issues.warning > 0 ? <span className="text-amber-400">{issues.warning}</span> : null}
        </ToolButton>
        <ThemeMenu />
      </div>
    </header>
  )
}

function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

const INTERVAL_LABEL: Record<AutosaveIntervalSec, string> = {
  30: '30 秒',
  60: '1 分钟',
  120: '2 分钟',
  300: '5 分钟'
}

function AutosaveMenu(): JSX.Element {
  const enabled = useSettingsStore((state) => state.autosaveEnabled)
  const interval = useSettingsStore((state) => state.autosaveIntervalSec)
  const setEnabled = useSettingsStore((state) => state.setAutosaveEnabled)
  const setIntervalSec = useSettingsStore((state) => state.setAutosaveIntervalSec)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  return (
    <div
      ref={rootRef}
      className="relative flex items-center"
      title="未命名文件不会自动保存"
    >
      <ToolButton
        aria-label="自动保存"
        data-testid="autosave-toggle"
        active={enabled}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5" />
          自动保存
        </span>
      </ToolButton>
      {open ? (
        <div
          data-testid="autosave-menu"
          className="absolute left-0 top-full z-30 mt-1 min-w-[132px] rounded-md border border-border bg-panel py-1 text-xs shadow-lg"
        >
          <AutosaveOption
            label="关闭"
            active={!enabled}
            onClick={() => {
              setEnabled(false)
              setOpen(false)
            }}
          />
          {AUTOSAVE_INTERVALS.map((seconds) => (
            <AutosaveOption
              key={seconds}
              label={INTERVAL_LABEL[seconds]}
              active={enabled && interval === seconds}
              onClick={() => {
                setEnabled(true)
                setIntervalSec(seconds)
                setOpen(false)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AutosaveOption({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full px-3 py-1.5 text-left',
        active ? 'bg-elevated text-accent' : 'text-primary hover:bg-elevated'
      )}
    >
      {label}
    </button>
  )
}

function ThemeMenu(): JSX.Element {
  const mode = useThemeStore((state) => state.mode)
  const accent = useThemeStore((state) => state.accent)
  const toggleMode = useThemeStore((state) => state.toggleMode)
  const setAccent = useThemeStore((state) => state.setAccent)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  return (
    <div ref={rootRef} className="relative flex items-center">
      <ToolButton aria-label="切换主题" onClick={toggleMode} data-testid="theme-toggle">
        {mode === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </ToolButton>
      <ToolButton aria-label="强调色" onClick={() => setOpen((value) => !value)} data-testid="accent-toggle">
        <span
          className="h-3 w-3 rounded-full border border-border"
          style={{ backgroundColor: ACCENT_HEX[accent][mode] }}
        />
      </ToolButton>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 flex gap-1 rounded-md border border-border bg-panel p-1.5 shadow-lg">
          {ACCENT_PRESETS.map((preset: AccentPreset) => (
            <button
              key={preset}
              type="button"
              title={preset}
              className={cn(
                'h-5 w-5 rounded-full border',
                accent === preset ? 'border-primary' : 'border-transparent'
              )}
              style={{ backgroundColor: ACCENT_HEX[preset][mode] }}
              onClick={() => {
                setAccent(preset)
                setOpen(false)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
