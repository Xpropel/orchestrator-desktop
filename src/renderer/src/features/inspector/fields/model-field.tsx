import { useEffect, useRef, useState, type JSX } from 'react'
import { ChevronDown } from 'lucide-react'
import { isModelPresetId, modelPresetsGrouped, resolveModel } from '@/core/models'
import { asString } from '@/features/inspector/form-utils'
import { Button } from '@/ui/button'
import { Field } from '@/ui/field'
import { Input } from '@/ui/input'
import { ModelProviderIcon } from '@/ui/model-icons'
import { cn } from '@/ui/cn'
import type { SchemaFieldProps } from '../field-types'

const PLACEHOLDER = '选择模型'
const CUSTOM_LABEL = '自定义模型名…'

export function ModelField({ field, value, onChange }: SchemaFieldProps): JSX.Element {
  const current = asString(value)
  const resolved = resolveModel(current)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(() => current.trim().length > 0 && !isModelPresetId(current.trim()))
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const trimmed = current.trim()
    if (trimmed && isModelPresetId(trimmed)) {
      setCustom(false)
    } else if (trimmed && !isModelPresetId(trimmed)) {
      setCustom(true)
    }
  }, [current])

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

  const pick = (id: string): void => {
    setCustom(false)
    setOpen(false)
    onChange(id)
  }

  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>
      {custom ? (
        <div className="flex flex-col gap-1" data-testid="model-field-custom">
          <Input
            data-testid="model-field-custom-input"
            value={current}
            placeholder={field.placeholder ?? '输入模型 id'}
            onChange={(event) => onChange(event.target.value)}
          />
          <button
            type="button"
            className="self-start text-[11px] text-secondary hover:text-primary"
            onClick={() => {
              setCustom(false)
              setOpen(true)
            }}
          >
            从预设选择
          </button>
        </div>
      ) : (
        <div ref={rootRef} className="relative" data-testid="model-field">
          <Button
            data-testid="model-field-trigger"
            className="h-8 w-full justify-between px-2 font-normal"
            onClick={() => setOpen((next) => !next)}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {resolved ? (
                <>
                  <ModelProviderIcon provider={resolved.provider} className="h-[22px] w-[22px]" />
                  <span className="truncate">{resolved.name}</span>
                </>
              ) : (
                <span className="text-secondary">{PLACEHOLDER}</span>
              )}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-secondary" />
          </Button>
          <div
            hidden={!open}
            className={cn(
              'absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-panel py-1 shadow-lg',
              !open && 'pointer-events-none'
            )}
            data-testid="model-field-menu"
          >
            {modelPresetsGrouped().map((group) => (
              <div key={group.provider}>
                <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-secondary">{group.title}</p>
                {group.presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`model-option-${preset.id}`}
                    className={cn(
                      'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs text-primary hover:bg-elevated',
                      current === preset.id && 'bg-elevated'
                    )}
                    onClick={() => pick(preset.id)}
                  >
                    <ModelProviderIcon provider={preset.provider} className="h-4 w-4" />
                    <span className="truncate">{preset.id}</span>
                  </button>
                ))}
              </div>
            ))}
            <button
              type="button"
              data-testid="model-option-custom"
              className="flex w-full items-center px-2 py-1.5 text-left text-xs text-secondary hover:bg-elevated hover:text-primary"
              onClick={() => {
                setCustom(true)
                setOpen(false)
              }}
            >
              {CUSTOM_LABEL}
            </button>
          </div>
        </div>
      )}
    </Field>
  )
}
