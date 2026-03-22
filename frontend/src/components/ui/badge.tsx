import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/cn'

const badgeVariants = cva(
	'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] transition-colors',
	{
		variants: {
			variant: {
				success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
				pending: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
				destructive: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
				info: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
				neutral: 'border-white/12 bg-white/6 text-slate-200',
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
