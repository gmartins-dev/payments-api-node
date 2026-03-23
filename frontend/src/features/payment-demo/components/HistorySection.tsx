import { Badge } from '../../../components/ui/badge'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '../../../components/ui/card'
import type { AttemptGroup, AttemptRecord } from '../model'
import { formatDuration, formatJson, formatTimestamp } from '../model'
import { HistoryMeta } from './history-shared'
import { ActionBadge, OutcomeBadge, ResultModeBadge } from './status-badges'

export function HistorySection({ groupedAttempts }: { groupedAttempts: AttemptGroup[] }) {
	return (
		<Card className="reveal">
			<CardHeader className="gap-3">
				<CardTitle>Histórico técnico</CardTitle>
				<CardDescription>
					Use esta área quando quiser auditar cada tentativa, conferir duração, request id e o JSON
					completo de cada resposta.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{groupedAttempts.length === 0 ? (
					<div className="rounded-[24px] border border-dashed border-[color:var(--color-border-soft)] bg-[color:rgba(13,18,28,0.64)] p-6">
						<p className="text-base font-medium text-slate-100">Nenhum teste executado ainda.</p>
						<p className="mt-2 text-sm leading-6 text-slate-400">
							Assim que você criar um pagamento, repetir a mesma chave ou simular concorrência, o
							histórico vai reunir tudo aqui por chave de idempotência.
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{groupedAttempts.map((group) => (
							<AttemptGroupCard group={group} key={group.idempotencyKey} />
						))}
					</div>
				)}
			</CardContent>
		</Card>
	)
}

function AttemptGroupCard({ group }: { group: AttemptGroup }) {
	return (
		<article className="rounded-[28px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-panel)] p-5 shadow-[0_18px_40px_rgba(16,24,40,0.24)] history-enter">
			<div className="flex flex-col gap-4 border-b border-[color:var(--color-border-faint)] pb-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-2">
					<p className="text-xs uppercase tracking-[0.24em] text-slate-500">
						Chave de idempotência
					</p>
					<h3 className="break-all font-display text-2xl text-white">{group.idempotencyKey}</h3>
					<p className="text-sm leading-6 text-slate-400">
						{group.totalRequests} {group.totalRequests === 1 ? 'requisição' : 'requisições'} •
						última atividade {formatTimestamp(group.latestAt)}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<OutcomeBadge outcome={group.latestOutcome} />
					{group.hasReplay ? <Badge variant="info">Resposta persistida</Badge> : null}
					{group.hasSharedOutcome ? <Badge variant="info">Resultado compartilhado</Badge> : null}
				</div>
			</div>

			<div className="mt-4 space-y-4">
				{group.attempts.map((attempt, index) => (
					<AttemptRow attempt={attempt} defaultOpen={index === 0} key={attempt.id} />
				))}
			</div>
		</article>
	)
}

function AttemptRow({ attempt, defaultOpen }: { attempt: AttemptRecord; defaultOpen: boolean }) {
	return (
		<section className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-[color:rgba(13,18,28,0.78)] p-4 transition-all duration-300">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-3">
					<div className="flex flex-wrap gap-2">
						<ActionBadge actionType={attempt.actionType} />
						<OutcomeBadge outcome={attempt.outcome} />
						<ResultModeBadge attempt={attempt} />
						{attempt.httpStatus !== null ? (
							<Badge variant="neutral">HTTP {attempt.httpStatus}</Badge>
						) : null}
					</div>
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
							{attempt.label}
						</p>
						<h4 className="mt-2 font-display text-2xl text-white">{attempt.headline}</h4>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{attempt.detail}</p>
					</div>
				</div>

				<div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:min-w-[320px]">
					<HistoryMeta label="Início" value={formatTimestamp(attempt.createdAt)} />
					<HistoryMeta label="Duração" value={formatDuration(attempt.elapsedMs)} />
					<HistoryMeta
						label="ID da requisição"
						value={attempt.requestId ?? 'Pendente ou indisponível'}
					/>
					<HistoryMeta
						label="Consultas do cliente"
						value={
							attempt.pollCount > 0
								? `${attempt.pollCount} ${attempt.pollCount === 1 ? 'consulta' : 'consultas'}`
								: 'Nenhuma'
						}
					/>
				</div>
			</div>

			<details
				className="mt-4 rounded-[22px] border border-[color:var(--color-border-faint)] bg-[color:rgba(13,18,28,0.78)] p-4"
				open={defaultOpen}
			>
				<summary className="cursor-pointer list-none text-sm font-medium text-slate-100 [&::-webkit-details-marker]:hidden">
					Ver payload e resposta em JSON
				</summary>
				<div className="mt-4 grid gap-4 xl:grid-cols-2">
					<div>
						<p className="text-xs uppercase tracking-[0.22em] text-slate-500">
							Payload da requisição
						</p>
						<div className="mt-2 overflow-x-auto rounded-2xl bg-[color:rgba(13,18,28,0.92)] p-4 text-xs leading-6 text-slate-200">
							<pre>{formatJson(attempt.requestPayload)}</pre>
						</div>
					</div>
					<div>
						<p className="text-xs uppercase tracking-[0.22em] text-slate-500">Corpo da resposta</p>
						<div className="mt-2 overflow-x-auto rounded-2xl bg-[color:rgba(13,18,28,0.92)] p-4 text-xs leading-6 text-slate-200">
							<pre>{formatJson(attempt.body ?? { status: 'PENDENTE' })}</pre>
						</div>
					</div>
				</div>
			</details>
		</section>
	)
}
