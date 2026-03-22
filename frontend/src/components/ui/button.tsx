import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] text-slate-950 shadow-[0_14px_36px_rgba(14,165,233,0.28)] hover:brightness-105',
        secondary:
          'bg-[linear-gradient(135deg,#f59e0b,#fb7185)] text-white shadow-[0_14px_36px_rgba(251,113,133,0.2)] hover:brightness-105',
        outline:
          'border border-white/12 bg-white/6 text-slate-100 shadow-none hover:bg-white/10'
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 px-3 text-xs uppercase tracking-[0.2em]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return <Comp className={cn(buttonVariants({ variant, size, className }))} data-slot="button" {...props} />
}

export { Button, buttonVariants }
