import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/cn'

const badgeVariants = cva(
	'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] transition-colors',
	{
		variants: {
			variant: {
				success:
					'border-[color:rgba(65,126,56,0.38)] bg-[color:rgba(65,126,56,0.18)] text-[color:#edf2eb]',
				pending:
					'border-[color:rgba(174,95,0,0.35)] bg-[color:rgba(174,95,0,0.16)] text-[color:#fad9b0]',
				destructive:
					'border-[color:rgba(222,26,27,0.35)] bg-[color:rgba(222,26,27,0.16)] text-[color:#fad3d4]',
				info: 'border-[color:rgba(12,123,179,0.35)] bg-[color:rgba(12,123,179,0.16)] text-[color:#bce6fc]',
				neutral:
					'border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] text-slate-200',
			},
		},
		defaultVariants: {
			variant: 'neutral',
		},
	},
)

function Badge({
	className,
	variant,
	...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
	return <span className={cn(badgeVariants({ variant }), className)} data-slot="badge" {...props} />
}

export { Badge, badgeVariants }
