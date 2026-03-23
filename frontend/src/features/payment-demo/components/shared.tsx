import type { ReactNode } from 'react'

import { Button } from '../../../components/ui/button'
import { formatJson } from '../model'
import { formatAmountPreview } from '../utils/presentation'

export function GuideCard({
	description,
	step,
	title,
}: {
	description: string
	step: string
	title: string
}) {
	return (
		<article className="rounded-[26px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-5">
			<div className="flex items-start gap-4">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:rgba(132,186,100,0.32)] bg-[color:rgba(65,126,56,0.18)] text-sm font-semibold text-slate-50">
					{step}
				</div>
				<div>
					<h2 className="font-display text-xl text-white">{title}</h2>
					<p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
				</div>
			</div>
		</article>
	)
}

export function SectionLead({
	description,
	step,
	title,
}: {
	description: string
	step: string
	title: string
}) {
	return (
		<div className="space-y-2">
			<p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
				Passo {step}
			</p>
			<h2 className="font-display text-2xl text-white">{title}</h2>
			<p className="max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
		</div>
	)
}

export function Field({
	children,
	description,
	htmlFor,
	label,
}: {
	children: ReactNode
	description?: string
	htmlFor: string
	label: string
}) {
	return (
		<div className="space-y-2">
			<label
				className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400"
				htmlFor={htmlFor}
			>
				{label}
			</label>
			{children}
			{description ? <p className="text-xs leading-5 text-slate-500">{description}</p> : null}
		</div>
	)
}

export function RequestSnapshot({
	amount,
	customerId,
	idempotencyKey,
}: {
	amount: string
	customerId: string
	idempotencyKey: string
}) {
	return (
		<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[160px_180px_minmax(0,1fr)]">
			<SnapshotItem label="Valor" value={formatAmountPreview(amount)} />
			<SnapshotItem label="Cliente" value={customerId || 'Não informado'} />
			<SnapshotItem code label="Chave atual" value={idempotencyKey || 'Não informada'} />
		</div>
	)
}

export function ActionCard({
	buttonLabel,
	description,
	isBusy,
	isLoading,
	loadingLabel,
	onClick,
	title,
	variant,
}: {
	buttonLabel: string
	description: string
	isBusy: boolean
	isLoading: boolean
	loadingLabel: string
	onClick: () => void
	title: string
	variant: 'default' | 'outline' | 'secondary'
}) {
	return (
		<article className="rounded-[26px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-5">
			<p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
			<p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
			<Button className="mt-5 w-full" disabled={isBusy} onClick={onClick} variant={variant}>
				<ButtonLabel isLoading={isLoading} label={buttonLabel} loadingLabel={loadingLabel} />
			</Button>
		</article>
	)
}

export function JsonPanel({
	badges,
	caption,
	title,
	value,
}: {
	badges?: ReactNode
	caption: string
	title: string
	value: unknown
}) {
	return (
		<div className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-panel)] p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p className="text-xs uppercase tracking-[0.24em] text-slate-500">{caption}</p>
					<h3 className="mt-3 font-display text-xl text-slate-50">{title}</h3>
				</div>
				{badges}
			</div>
			<div className="mt-4 overflow-x-auto rounded-2xl bg-[color:rgba(13,18,28,0.92)] p-4 text-xs leading-6 text-slate-200">
				<pre>{formatJson(value)}</pre>
			</div>
		</div>
	)
}

export function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-[24px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-4 py-4">
			<p className="text-[11px] leading-5 font-medium uppercase tracking-[0.18em] text-slate-500">
				{label}
			</p>
			<p className="mt-3 min-w-0 text-base leading-7 font-medium text-white [overflow-wrap:anywhere]">
				{value}
			</p>
		</div>
	)
}

export function MonitorMeta({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-[color:var(--color-border-faint)] bg-[color:var(--color-surface-muted)] px-3 py-3">
			<p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
			<p className="mt-2 break-all text-sm text-slate-100">{value}</p>
		</div>
	)
}

export function ButtonLabel({
	isLoading,
	label,
	loadingLabel,
}: {
	isLoading: boolean
	label: string
	loadingLabel: string
}) {
	if (!isLoading) {
		return label
	}

	return (
		<span className="inline-flex items-center gap-2">
			<Spinner />
			{loadingLabel}
		</span>
	)
}

export function Spinner() {
	return (
		<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
	)
}

function SnapshotItem({
	code = false,
	label,
	value,
}: {
	code?: boolean
	label: string
	value: string
}) {
	return (
		<div className="rounded-[22px] border border-[color:var(--color-border-faint)] bg-[color:var(--color-surface-muted)] px-4 py-4">
			<p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
			<p
				className={[
					'mt-3 break-all text-sm text-slate-100',
					code ? 'font-mono leading-6' : 'leading-6',
				].join(' ')}
			>
				{value}
			</p>
		</div>
	)
}
