export function HistoryMeta({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-[color:var(--color-border-faint)] bg-[color:var(--color-surface-muted)] px-3 py-3">
			<p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
			<p className="mt-2 break-all text-sm text-slate-100">{value}</p>
		</div>
	)
}
