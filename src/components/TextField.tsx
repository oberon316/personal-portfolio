import { useId } from 'react'
import type { ChangeEvent } from 'react'

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  placeholder?: string
  required?: boolean
  maxLength?: number
  multiline?: boolean
  rows?: number
  type?: 'text' | 'email' | 'url'
  fullWidth?: boolean
}

export function TextField({ label, value, onChange, error, hint, placeholder, required, maxLength, multiline, rows = 4, type = 'text', fullWidth }: TextFieldProps) {
  const id = useId()
  const common = { id, value, placeholder, required, maxLength, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? `${id}-help` : undefined, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) }
  return <div className={`field${fullWidth ? ' full-width' : ''}`}>
    <label htmlFor={id}>{label}{required && ' *'}</label>
    {multiline ? <textarea {...common} rows={rows} /> : <input {...common} type={type} />}
    {(error || hint) && <small id={`${id}-help`} className={error ? 'field-error' : 'field-hint'}>{error || hint}</small>}
  </div>
}
