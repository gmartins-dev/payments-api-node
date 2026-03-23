import type { ReactNode } from 'react'

import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import {
	type AttemptGroup,
	type AttemptRecord,
	formatDuration,
	formatJson,
	formatTimestamp,
} from './features/payment-demo/model'
import { usePaymentDemo } from './features/payment-demo/usePaymentDemo'

const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const apiDocsUrl = `${apiUrl}/docs`

export function App() {
	const {
		errorMessage,
		form,
		groupedAttempts,
		handleConcurrentRequests,
		handleCreatePayment,
		handleReplaySameRequest,
		isBusy,
		latestAttempt,
		liveFlow,
		refreshIdempotencyKey,
		requestPayload,
		scenarios,
		setFormField,
	} = usePaymentDemo(apiUrl)

	const latestOutcome = liveFlow.isLoading
		? liveFlow.stage === 'IDLE'
			? 'REQUEST_CREATED'
			: liveFlow.stage
		: (latestAttempt?.outcome ?? 'IDLE')
	const latestResponseTime = latestAttempt?.elapsedMs ?? null
	const lastUpdated = latestAttempt?.updatedAt ?? liveFlow.updatedAt

	return (
		<main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_50%_-5%,_rgba(132,186,100,0.18),_transparent_28%),linear-gradient(180deg,_rgba(44,52,55,0.16),_transparent_38%),var(--color-page)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
			<div className="mx-auto flex max-w-7xl flex-col gap-6">
				<section className="reveal rounded-[36px] border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(44,52,55,0.28),rgba(13,18,28,0.94))] p-8 shadow-[0_30px_120px_rgba(16,24,40,0.32)] backdrop-blur-xl">
					<div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
						<div className="max-w-3xl space-y-4">
							<p className="text-xs font-semibold uppercase tracking-[0.38em] text-[var(--color-accent)]">
								Demo de Idempotência em Pagamentos
							</p>
							<h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
								Uma chave, um resultado persistido, nenhum processamento duplicado.
							</h1>
							<p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
								Acompanhe o ciclo completo da requisição, repita a mesma chave de idempotência e
								compare requisições paralelas sem sair da interface.
							</p>
						</div>

						<div className="flex w-full flex-col gap-4 xl:max-w-3xl xl:items-end">
							<Button asChild className="self-start xl:self-auto" size="sm" variant="outline">
								<a href={apiDocsUrl} rel="noreferrer" target="_blank">
									Docs da API
								</a>
							</Button>

							<div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-5">
								<Metric label="Alvo da API" value={apiUrl.replace(/^https?:\/\//, '')} />
								<Metric label="Último resultado" value={formatStageLabel(latestOutcome)} />
								<Metric label="Tempo de resposta" value={formatDuration(latestResponseTime)} />
								<Metric
									label="Requisições"
									value={String(
										groupedAttempts.reduce((sum, group) => sum + group.totalRequests, 0),
									)}
								/>
								<Metric
									label="Última atualização"
									value={lastUpdated ? formatTimestamp(lastUpdated) : 'Ainda sem requisições'}
								/>
							</div>
						</div>
					</div>
				</section>

				<section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
					<Card className="reveal">
						<CardHeader>
							<CardTitle>Laboratório de pagamentos</CardTitle>
							<CardDescription>
								Use a mesma chave de idempotência para provar a resposta persistida ou envie duas
								requisições em paralelo para inspecionar a segurança de concorrência.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid gap-4 md:grid-cols-3">
								<Field htmlFor="payment-amount" label="Valor">
									<Input
										id="payment-amount"
										inputMode="decimal"
										onChange={(event) => setFormField('amount', event.target.value)}
										placeholder="100"
										value={form.amount}
									/>
								</Field>
								<Field htmlFor="payment-customer-id" label="ID do cliente">
									<Input
										id="payment-customer-id"
										onChange={(event) => setFormField('customerId', event.target.value)}
										placeholder="cliente-1"
										value={form.customerId}
									/>
								</Field>
								<Field
									description="Mesma chave = mesmo resultado (idempotente)"
									htmlFor="payment-idempotency-key"
									label="Chave de idempotência"
								>
									<div className="flex gap-2">
										<Input
											className="flex-1"
											id="payment-idempotency-key"
											onChange={(event) => setFormField('idempotencyKey', event.target.value)}
											placeholder="pagamento-demo-001"
											value={form.idempotencyKey}
										/>
										<Button
											className="shrink-0"
											disabled={isBusy}
											onClick={refreshIdempotencyKey}
											size="sm"
											variant="outline"
										>
											Nova chave
										</Button>
									</div>
								</Field>
							</div>

							<div className="flex flex-col gap-3 md:flex-row">
								<Button className="md:flex-1" disabled={isBusy} onClick={handleCreatePayment}>
									<ButtonLabel
										isLoading={isBusy && liveFlow.actionType === 'CREATE'}
										label="Criar pagamento"
										loadingLabel="Processando..."
									/>
								</Button>
								<Button
									className="md:flex-1"
									disabled={isBusy}
									onClick={handleReplaySameRequest}
									variant="outline"
								>
									<ButtonLabel
										isLoading={isBusy && liveFlow.actionType === 'REPLAY'}
										label="Repetir mesma requisição (mesma chave)"
										loadingLabel="Repetindo..."
									/>
								</Button>
								<Button
									className="md:flex-1"
									disabled={isBusy}
									onClick={handleConcurrentRequests}
									variant="secondary"
								>
									<ButtonLabel
										isLoading={isBusy && liveFlow.actionType === 'CONCURRENT'}
										label="Simular concorrência (2 requisições paralelas)"
										loadingLabel="Executando fluxo paralelo..."
									/>
								</Button>
							</div>

							{errorMessage ? (
								<div className="rounded-2xl border border-[color:rgba(222,26,27,0.35)] bg-[color:rgba(222,26,27,0.14)] px-4 py-3 text-sm text-rose-200">
									{errorMessage}
								</div>
							) : null}

							<div className="grid gap-4 lg:grid-cols-2">
								<JsonPanel
									caption="Payload atual da requisição"
									title="Payload da requisição"
									value={{
										amount: requestPayload.amount,
										customerId: requestPayload.customerId,
										idempotencyKey: form.idempotencyKey,
									}}
								/>
								<JsonPanel
									badges={
										latestAttempt ? (
											<div className="flex flex-wrap gap-2">
												<OutcomeBadge outcome={latestAttempt.outcome} />
												<ResultModeBadge attempt={latestAttempt} />
												{latestAttempt.httpStatus !== null ? (
													<Badge variant="neutral">HTTP {latestAttempt.httpStatus}</Badge>
												) : null}
											</div>
										) : null
									}
									caption={
										latestAttempt
											? `${latestAttempt.headline}${latestAttempt.requestId ? ` • ${latestAttempt.requestId}` : ''}`
											: 'Sem resposta ainda'
									}
									title="Corpo da última resposta"
									value={latestAttempt?.body ?? { status: 'AGUARDANDO' }}
								/>
							</div>
						</CardContent>
					</Card>

					<Card className="reveal">
						<CardHeader>
							<CardTitle>Monitor de comportamento</CardTitle>
							<CardDescription>
								A interface acompanha as transições do ciclo de vida, as respostas persistidas e os
								quatro cenários-chave de idempotência conforme eles acontecem.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-panel)] p-5">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div className="space-y-2">
										<p className="text-xs uppercase tracking-[0.24em] text-slate-500">
											Ciclo de vida da requisição
										</p>
										<h3 className="font-display text-2xl text-slate-50">{liveFlow.title}</h3>
										<p className="max-w-xl text-sm leading-6 text-slate-300">
											{liveFlow.description}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<StageBadge stage={liveFlow.stage} />
										{liveFlow.actionType ? (
											<Badge variant="neutral">{formatActionTypeLabel(liveFlow.actionType)}</Badge>
										) : null}
									</div>
								</div>

								<div className="mt-5">
									<LifecycleRail stage={liveFlow.stage} />
								</div>

								<div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
									<MonitorMeta
										label="Chave de idempotência"
										value={liveFlow.idempotencyKey ?? 'Aguardando a próxima requisição'}
									/>
									<MonitorMeta
										label="Requisições concluídas"
										value={
											liveFlow.totalRequests > 0
												? `${liveFlow.completedRequests}/${liveFlow.totalRequests}`
												: '0/0'
										}
									/>
									<MonitorMeta
										label="Atualizado"
										value={liveFlow.updatedAt ? formatTimestamp(liveFlow.updatedAt) : 'Inativo'}
									/>
								</div>
							</div>

							<div className="rounded-[24px] border border-cyan-400/16 bg-[color:rgba(65,126,56,0.12)] p-5">
								<p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">
									Último insight
								</p>
								{latestAttempt ? (
									<div className="mt-3 space-y-3">
										<div className="flex flex-wrap gap-2">
											<OutcomeBadge outcome={latestAttempt.outcome} />
											<ResultModeBadge attempt={latestAttempt} />
											<ActionBadge actionType={latestAttempt.actionType} />
										</div>
										<div>
											<h3 className="font-display text-xl text-white">{latestAttempt.headline}</h3>
											<p className="mt-2 text-sm leading-6 text-cyan-50/90">
												{latestAttempt.detail}
											</p>
										</div>
									</div>
								) : (
									<p className="mt-3 text-sm leading-6 text-cyan-50/90">
										Crie um pagamento para ver o ciclo de vida da requisição, os indicadores de
										resposta persistida e os insights de concorrência aparecerem.
									</p>
								)}
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								{scenarios.map((scenario) => (
									<ScenarioCard key={scenario.id} scenario={scenario} />
								))}
							</div>
						</CardContent>
					</Card>
				</section>

				<Card className="reveal">
					<CardHeader>
						<CardTitle>Histórico de tentativas</CardTitle>
						<CardDescription>
							Agrupe as requisições por chave de idempotência e inspecione se cada resposta foi
							processada do zero, reproduzida a partir do armazenamento ou compartilhada por
							requisições concorrentes.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{groupedAttempts.length === 0 ? (
							<div className="rounded-[24px] border border-dashed border-[color:var(--color-border-soft)] bg-[color:rgba(13,18,28,0.64)] p-6 text-sm leading-6 text-slate-400">
								Nenhuma requisição ainda. Crie um pagamento para ver a idempotência em ação.
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
			</div>
		</main>
	)
}

function Field({
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

function ButtonLabel({
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

function JsonPanel({
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

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-4 py-4">
			<p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
			<p className="mt-3 text-sm leading-6 text-white">{value}</p>
		</div>
	)
}

function LifecycleRail({
	stage,
}: {
	stage: 'IDLE' | 'REQUEST_CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED'
}) {
	const steps = [
		{ key: 'REQUEST_CREATED', label: 'Requisição criada' },
		{ key: 'PENDING', label: 'Pendente' },
		{ key: 'SUCCESS', label: 'Sucesso' },
		{ key: 'FAILED', label: 'Falha' },
	] as const

	return (
		<div className="grid gap-3 sm:grid-cols-4">
			{steps.map((step, index) => {
				const isActive = stage === step.key
				const isComplete = isStepComplete(stage, step.key)

				return (
					<div
						className="rounded-[22px] border border-[color:var(--color-border-soft)] bg-[color:rgba(13,18,28,0.84)] p-4 transition-all duration-300"
						key={step.key}
					>
						<div className="flex items-center gap-3">
							<div
								className={[
									'flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300',
									isActive
										? stage === 'FAILED'
											? 'border-rose-400/30 bg-rose-500/20 text-rose-100'
											: 'border-cyan-300/30 bg-cyan-500/20 text-cyan-50'
										: isComplete
											? 'border-emerald-400/20 bg-emerald-500/15 text-emerald-100'
											: 'border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] text-slate-500',
								].join(' ')}
							>
								{index + 1}
							</div>
							<div>
								<p className="text-xs uppercase tracking-[0.24em] text-slate-500">
									Etapa {index + 1}
								</p>
								<p className="mt-1 text-sm font-medium text-slate-100">{step.label}</p>
							</div>
						</div>
					</div>
				)
			})}
		</div>
	)
}

function MonitorMeta({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-[color:var(--color-border-faint)] bg-[color:var(--color-surface-muted)] px-3 py-3">
			<p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
			<p className="mt-2 break-all text-sm text-slate-100">{value}</p>
		</div>
	)
}

function ScenarioCard({
	scenario,
}: {
	scenario: {
		description: string
		message: string
		observedAt: string | null
		status: 'active' | 'idle' | 'observed'
		title: string
	}
}) {
	return (
		<article className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-panel)] p-5 transition-all duration-300">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-2">
					<h3 className="font-display text-xl text-slate-50">{scenario.title}</h3>
					<p className="text-sm leading-6 text-slate-400">{scenario.description}</p>
				</div>
				<ScenarioStatusBadge status={scenario.status} />
			</div>
			<p className="mt-4 text-sm leading-6 text-slate-200">{scenario.message}</p>
			<p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
				{scenario.observedAt
					? `Atualizado em ${formatTimestamp(scenario.observedAt)}`
					: 'Aguardando observação'}
			</p>
		</article>
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
						última atualização {formatTimestamp(group.latestAt)}
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
						label="Consultas"
						value={
							attempt.pollCount > 0
								? `${attempt.pollCount} ${attempt.pollCount === 1 ? 'requisição' : 'requisições'} de acompanhamento`
								: 'Sem consultas automáticas do cliente'
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

function HistoryMeta({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-[color:var(--color-border-faint)] bg-[color:var(--color-surface-muted)] px-3 py-3">
			<p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
			<p className="mt-2 break-all text-sm text-slate-100">{value}</p>
		</div>
	)
}

function ActionBadge({ actionType }: { actionType: AttemptRecord['actionType'] }) {
	return <Badge variant="neutral">{formatActionTypeLabel(actionType)}</Badge>
}

function OutcomeBadge({ outcome }: { outcome: 'FAILED' | 'IDLE' | 'PENDING' | 'SUCCESS' }) {
	if (outcome === 'SUCCESS') {
		return <Badge variant="success">SUCESSO</Badge>
	}

	if (outcome === 'FAILED') {
		return <Badge variant="destructive">FALHA</Badge>
	}

	if (outcome === 'PENDING') {
		return <Badge variant="pending">PENDENTE</Badge>
	}

	return <Badge variant="neutral">INATIVO</Badge>
}

function ResultModeBadge({ attempt }: { attempt: AttemptRecord }) {
	if (attempt.resultMode === 'REUSED') {
		return <Badge variant="info">Resultado reutilizado</Badge>
	}

	if (attempt.resultMode === 'SHARED') {
		return <Badge variant="info">Resultado compartilhado</Badge>
	}

	if (attempt.resultMode === 'WAITING') {
		return <Badge variant="pending">Processando</Badge>
	}

	return <Badge variant="success">Processado</Badge>
}

function StageBadge({
	stage,
}: {
	stage: 'FAILED' | 'IDLE' | 'PENDING' | 'REQUEST_CREATED' | 'SUCCESS'
}) {
	if (stage === 'FAILED') {
		return <Badge variant="destructive">FALHA</Badge>
	}

	if (stage === 'SUCCESS') {
		return <Badge variant="success">SUCESSO</Badge>
	}

	if (stage === 'PENDING') {
		return <Badge variant="pending">PENDENTE</Badge>
	}

	if (stage === 'REQUEST_CREATED') {
		return <Badge variant="info">REQUISIÇÃO CRIADA</Badge>
	}

	return <Badge variant="neutral">INATIVO</Badge>
}

function ScenarioStatusBadge({ status }: { status: 'active' | 'idle' | 'observed' }) {
	if (status === 'observed') {
		return <Badge variant="info">Observado</Badge>
	}

	if (status === 'active') {
		return <Badge variant="pending">Ativo</Badge>
	}

	return <Badge variant="neutral">Pronto</Badge>
}

function Spinner() {
	return (
		<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
	)
}

function formatStageLabel(value: string) {
	return (
		{
			IDLE: 'Inativo',
			PENDING: 'Pendente',
			REQUEST_CREATED: 'Requisição criada',
			SUCCESS: 'Sucesso',
			FAILED: 'Falha',
		}[value] ?? value.replaceAll('_', ' ')
	)
}

function formatActionTypeLabel(value: 'CONCURRENT' | 'CREATE' | 'REPLAY') {
	return {
		CONCURRENT: 'CONCORRÊNCIA',
		CREATE: 'CRIAÇÃO',
		REPLAY: 'REPETIÇÃO',
	}[value]
}

function isStepComplete(
	currentStage: 'FAILED' | 'IDLE' | 'PENDING' | 'REQUEST_CREATED' | 'SUCCESS',
	step: 'FAILED' | 'PENDING' | 'REQUEST_CREATED' | 'SUCCESS',
) {
	const weights = {
		IDLE: 0,
		REQUEST_CREATED: 1,
		PENDING: 2,
		SUCCESS: 3,
		FAILED: 3,
	}

	if (currentStage === 'FAILED' && step === 'SUCCESS') {
		return false
	}

	if (currentStage === 'SUCCESS' && step === 'FAILED') {
		return false
	}

	return weights[currentStage] > weights[step]
}
