import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes safely — use everywhere instead of raw className strings.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
