import type * as React from 'react'

import { cn } from '../../lib/cn'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			className={cn(
				'flex h-11 w-full min-w-0 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-strong)] px-4 py-2 text-sm text-slate-50 shadow-[inset_0_1px_0_rgba(233,237,240,0.04)] outline-none transition-all duration-200 placeholder:text-slate-600 focus-visible:border-[var(--color-accent)] focus-visible:ring-[3px] focus-visible:ring-[color:var(--color-accent-soft)] focus-visible:shadow-[0_0_0_1px_rgba(132,186,100,0.16)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
				className,
			)}
			data-slot="input"
			type={type}
			{...props}
		/>
	)
}

export { Input }
