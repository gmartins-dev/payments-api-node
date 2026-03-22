import type * as React from 'react'

import { cn } from '../../lib/cn'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			className={cn(
				'flex h-11 w-full min-w-0 rounded-2xl border border-white/12 bg-slate-950/70 px-4 py-2 text-sm text-slate-50 shadow-xs outline-none transition placeholder:text-slate-500 focus-visible:border-[var(--color-accent)] focus-visible:ring-[3px] focus-visible:ring-[color:var(--color-accent-soft)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
				className,
			)}
			data-slot="input"
			type={type}
			{...props}
		/>
	)
}

export { Input }
