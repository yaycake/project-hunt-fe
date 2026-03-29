import { forwardRef } from 'react'
import { Button, type ButtonProps } from '@/components/ui/Button'

export type PrimaryButtonProps = Omit<ButtonProps, 'variant'>

/** @see Button — primary variant triggers global `button-bg.svg` styling in `index.css`. */
export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  function PrimaryButton(props, ref) {
    return <Button ref={ref} variant="primary" {...props} />
  },
)

PrimaryButton.displayName = 'PrimaryButton'
