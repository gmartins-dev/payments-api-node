import type * as React from 'react'

import { cn } from '../../lib/cn'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			className={cn(
				'rounded-[28px] border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(44,52,55,0.3),rgba(13,18,28,0.92))] text-slate-50 shadow-[0_24px_80px_rgba(16,24,40,0.3)] backdrop-blur-xl',
				className,
			)}
			data-slot="card"
			{...props}
		/>
	)
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			className={cn('flex flex-col space-y-2 p-6', className)}
			data-slot="card-header"
			{...props}
		/>
	)
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			className={cn('font-display text-2xl leading-none font-semibold tracking-tight', className)}
			data-slot="card-title"
			{...props}
		/>
	)
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			className={cn('text-sm leading-6 text-slate-400', className)}
			data-slot="card-description"
			{...props}
		/>
	)
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
	return <div className={cn('p-6 pt-0', className)} data-slot="card-content" {...props} />
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle }
