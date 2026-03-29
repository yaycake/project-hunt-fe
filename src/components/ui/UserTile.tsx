import { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

/** Use with `cn()` on non-`div` surfaces (e.g. dashed “Add team” `button`). */
export const userTileClassName =
  'overflow-hidden rounded-xl border border-border bg-user-tile'

export type UserTileProps = ComponentPropsWithoutRef<'div'>

/** Participant / roster card surface — uses `bg-user-tile` tokens from `index.css`. */
export function UserTile({ className, ...props }: UserTileProps) {
  return <div className={cn(userTileClassName, className)} {...props} />
}
