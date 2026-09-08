import {
  forwardRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type JSX,
  type KeyboardEvent,
  type TextareaHTMLAttributes
} from 'react'
import { Input } from './input'
import { Textarea } from './textarea'
import { useDebouncedCommit } from './use-debounced-commit'

interface DebouncedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onCommit: (value: string) => void
  delay?: number
  exists?: () => boolean
  onLocalChange?: (value: string) => void
}

interface DebouncedTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string
  onCommit: (value: string) => void
  delay?: number
  exists?: () => boolean
  onLocalChange?: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

export function DebouncedInput({
  value,
  onCommit,
  delay = 200,
  exists,
  onLocalChange,
  onBlur,
  onKeyDown,
  ...props
}: DebouncedInputProps): JSX.Element {
  const { local, setLocal, commitNow, revert } = useDebouncedCommit(value, onCommit, delay, exists)
  return (
    <Input
      {...props}
      value={local}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        setLocal(event.target.value)
        onLocalChange?.(event.target.value)
      }}
      onBlur={(event) => {
        commitNow()
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commitNow()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          revert()
        }
        onKeyDown?.(event)
      }}
    />
  )
}

export const DebouncedTextarea = forwardRef<HTMLTextAreaElement, DebouncedTextareaProps>(
  function DebouncedTextarea(
    { value, onCommit, delay = 200, exists, onLocalChange, onKeyDown, onBlur, ...props },
    ref
  ): JSX.Element {
    const { local, setLocal, commitNow, revert } = useDebouncedCommit(value, onCommit, delay, exists)
    return (
      <Textarea
        {...props}
        ref={ref}
        value={local}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          setLocal(event.target.value)
          onLocalChange?.(event.target.value)
        }}
        onBlur={(event) => {
          commitNow()
          onBlur?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            revert()
          }
          onKeyDown?.(event)
        }}
      />
    )
  }
)
