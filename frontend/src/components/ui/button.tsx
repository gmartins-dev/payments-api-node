import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../../lib/cn'

const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--color-accent-soft)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default:
					'border border-transparent bg-[var(--color-accent-strong)] text-white shadow-[0_14px_36px_rgba(16,24,40,0.22)] hover:bg-[var(--color-accent)]',
				secondary:
					'border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(44,52,55,0.9),rgba(44,52,55,0.74))] text-slate-100 shadow-[0_14px_36px_rgba(16,24,40,0.18)] hover:border-[color:rgba(85,96,102,0.72)] hover:bg-[linear-gradient(180deg,rgba(85,96,102,0.78),rgba(44,52,55,0.82))]',
				outline:
					'border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] text-slate-100 shadow-none hover:border-[color:rgba(85,96,102,0.72)] hover:bg-[color:rgba(44,52,55,0.34)]',
			},
			size: {
				default: 'h-11 px-4 py-2',
				sm: 'h-9 px-3 text-xs uppercase tracking-[0.2em]',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
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

	return (
		<Comp
			className={cn(buttonVariants({ variant, size, className }))}
			data-slot="button"
			{...props}
		/>
	)
}

export { Button, buttonVariants }
