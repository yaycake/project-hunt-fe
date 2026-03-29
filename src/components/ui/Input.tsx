import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Shared field chrome; focus ring comes from global `index.css` input rules. */
export const inputFieldClassName = cn(
  'w-full rounded-xl border border-border bg-white px-4 py-3 text-sm transition',
  'placeholder:text-muted-foreground/60',
)

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return <input ref={ref} type={type} className={cn(inputFieldClassName, className)} {...props} />
})

Input.displayName = 'Input'
