import {
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
}

interface DebouncedTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string
  onCommit: (value: string) => void
  delay?: number
  exists?: () => boolean
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

export function DebouncedInput({
  value,
  onCommit,
  delay = 200,
  exists,
  ...props
}: DebouncedInputProps): JSX.Element {
  const { local, setLocal } = useDebouncedCommit(value, onCommit, delay, exists)
  return (
    <Input
      {...props}
      value={local}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setLocal(event.target.value)}
    />
  )
}

export function DebouncedTextarea({
  value,
  onCommit,
  delay = 200,
  exists,
  onKeyDown,
  ...props
}: DebouncedTextareaProps): JSX.Element {
  const { local, setLocal } = useDebouncedCommit(value, onCommit, delay, exists)
  return (
    <Textarea
      {...props}
      value={local}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setLocal(event.target.value)}
      onKeyDown={onKeyDown}
    />
  )
}
