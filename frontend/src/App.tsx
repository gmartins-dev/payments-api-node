import type { ReactNode } from 'react'

import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import {
	type AttemptActionType,
	type AttemptGroup,
	type AttemptRecord,
	formatDuration,
	formatJson,
	formatTimestamp,
	type LiveFlowState,
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

	const requestCount = groupedAttempts.reduce((sum, group) => sum + group.totalRequests, 0)
	const latestOutcome = liveFlow.isLoading
		? liveFlow.stage === 'IDLE'
			? 'REQUEST_CREATED'
			: liveFlow.stage
		: (latestAttempt?.outcome ?? 'IDLE')
	const latestResponseTime = latestAttempt?.elapsedMs ?? null
	const lastUpdated = latestAttempt?.updatedAt ?? liveFlow.updatedAt
	const heroUpdatedAt = lastUpdated ? formatMetricTimestamp(lastUpdated) : 'Ainda sem eventos'

	return (
		<main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_50%_-5%,_rgba(132,186,100,0.18),_transparent_28%),linear-gradient(180deg,_rgba(44,52,55,0.16),_transparent_38%),var(--color-page)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
			<div className="mx-auto flex max-w-6xl flex-col gap-6">
				<section className="reveal rounded-[36px] border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(44,52,55,0.28),rgba(13,18,28,0.94))] p-6 shadow-[0_30px_120px_rgba(16,24,40,0.32)] backdrop-blur-xl sm:p-8">
					<div className="flex flex-col gap-8">
						<div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
							<div className="max-w-3xl space-y-4">
								<p className="text-xs font-semibold uppercase tracking-[0.38em] text-[var(--color-accent)]">
									Demo de Idempotência em Pagamentos
								</p>
								<h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
									Uma chave, um resultado persistido. Sem processamento duplicado.
								</h1>
								<p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
									Esta interface mostra quando a API processa de verdade, quando apenas devolve uma
									resposta já salva e como duas chamadas paralelas convergem para o mesmo desfecho.
								</p>
							</div>

							<div className="flex w-full max-w-3xl flex-col gap-4">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div className="rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-400">
										Observe o comportamento da API sem precisar abrir o backend.
									</div>
									<Button asChild size="sm" variant="outline">
										<a href={apiDocsUrl} rel="noreferrer" target="_blank">
											Swagger
										</a>
									</Button>
								</div>

								<div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
									<Metric label="API alvo" value={apiUrl.replace(/^https?:\/\//, '')} />
									<Metric label="Último resultado" value={formatStageLabel(latestOutcome)} />
									<Metric label="Tempo da resposta" value={formatDuration(latestResponseTime)} />
									<Metric label="Atualizado" value={heroUpdatedAt} />
								</div>
							</div>
						</div>

						<div className="grid gap-3 lg:grid-cols-3">
							<GuideCard
								description="A primeira chamada executa o processamento e salva a resposta final."
								step="1"
								title="Crie um pagamento"
							/>
							<GuideCard
								description="Repita a mesma chave para provar que o retorno é reutilizado, não recalculado."
								step="2"
								title="Repita a mesma requisição"
							/>
							<GuideCard
								description="Dispare duas chamadas em paralelo para ver um único resultado compartilhado."
								step="3"
								title="Compare concorrência"
							/>
						</div>
					</div>
				</section>

				<Card className="reveal">
					<CardHeader className="gap-3">
						<CardTitle>Teste agora</CardTitle>
						<CardDescription>
							Monte a requisição, escolha o experimento e veja uma explicação humana do retorno
							antes do JSON técnico.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-8">
						<section className="space-y-4">
							<SectionLead
								description="Preencha os dados básicos e defina a chave que identifica a requisição."
								step="1"
								title="Configure a requisição"
							/>

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
									description="Mesma chave = mesmo resultado persistido"
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
											Gerar nova chave
										</Button>
									</div>
								</Field>
							</div>

							<RequestSnapshot
								amount={form.amount}
								customerId={form.customerId}
								idempotencyKey={form.idempotencyKey}
							/>
						</section>

						<section className="space-y-4">
							<SectionLead
								description="Cada ação prova um comportamento diferente da API."
								step="2"
								title="Escolha o que quer validar"
							/>

							<div className="grid gap-3 xl:grid-cols-3">
								<ActionCard
									buttonLabel="Criar pagamento"
									description="Faz a primeira chamada e grava o resultado final dessa chave."
									isBusy={isBusy}
									isLoading={isBusy && liveFlow.actionType === 'CREATE'}
									loadingLabel="Processando..."
									onClick={handleCreatePayment}
									title="Fluxo normal"
									variant="default"
								/>
								<ActionCard
									buttonLabel="Repetir a mesma requisição"
									description="Usa a mesma chave para provar que a resposta persistida é reutilizada."
									isBusy={isBusy}
									isLoading={isBusy && liveFlow.actionType === 'REPLAY'}
									loadingLabel="Repetindo..."
									onClick={handleReplaySameRequest}
									title="Idempotência"
									variant="outline"
								/>
								<ActionCard
									buttonLabel="Simular duas chamadas paralelas"
									description="Dispara duas requisições simultâneas com a mesma chave para comparar o desfecho."
									isBusy={isBusy}
									isLoading={isBusy && liveFlow.actionType === 'CONCURRENT'}
									loadingLabel="Executando fluxo paralelo..."
									onClick={handleConcurrentRequests}
									title="Concorrência"
									variant="secondary"
								/>
							</div>

							{errorMessage ? (
								<div className="rounded-2xl border border-[color:rgba(222,26,27,0.35)] bg-[color:rgba(222,26,27,0.14)] px-4 py-3 text-sm text-rose-200">
									{errorMessage}
								</div>
							) : null}
						</section>

						<section className="space-y-4">
							<SectionLead
								description="Veja primeiro o que aconteceu em linguagem direta. O JSON fica logo abaixo, se você quiser validar o detalhe técnico."
								step="3"
								title="Entenda o retorno"
							/>

							<ResultSummaryCard latestAttempt={latestAttempt} liveFlow={liveFlow} />

							<details className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-5">
								<summary className="cursor-pointer list-none text-sm font-medium text-slate-100 [&::-webkit-details-marker]:hidden">
									Abrir payload e JSON técnico
								</summary>
								<div className="mt-4 grid gap-4 lg:grid-cols-2">
									<JsonPanel
										caption="O que será enviado nesta chave"
										title="Payload atual"
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
							</details>
						</section>
					</CardContent>
				</Card>

				<section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
					<Card className="reveal">
						<CardHeader className="gap-3">
							<CardTitle>Acompanhe ao vivo</CardTitle>
							<CardDescription>
								Este painel mostra o estado atual da chave, a etapa do ciclo de vida e a leitura do
								que a API acabou de fazer.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5">
							<CurrentStatusCard
								latestAttempt={latestAttempt}
								liveFlow={liveFlow}
								requestCount={requestCount}
							/>
						</CardContent>
					</Card>

					<Card className="reveal">
						<CardHeader className="gap-3">
							<CardTitle>Cenários guiados</CardTitle>
							<CardDescription>
								Cada cartão traduz o que você está tentando provar e qual mensagem a interface exibe
								quando esse caso acontece.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-3 sm:grid-cols-2">
							{scenarios.map((scenario) => (
								<ScenarioCard key={scenario.id} scenario={scenario} />
							))}
						</CardContent>
					</Card>
				</section>

				<Card className="reveal">
					<CardHeader className="gap-3">
						<CardTitle>Histórico técnico</CardTitle>
						<CardDescription>
							Use esta área quando quiser auditar cada tentativa, conferir duração, request id e o
							JSON completo de cada resposta.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{groupedAttempts.length === 0 ? (
							<div className="rounded-[24px] border border-dashed border-[color:var(--color-border-soft)] bg-[color:rgba(13,18,28,0.64)] p-6">
								<p className="text-base font-medium text-slate-100">
									Nenhum teste executado ainda.
								</p>
								<p className="mt-2 text-sm leading-6 text-slate-400">
									Assim que você criar um pagamento, repetir a mesma chave ou simular concorrência,
									o histórico vai reunir tudo aqui por chave de idempotência.
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
			</div>
		</main>
	)
}

function GuideCard({
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

function SectionLead({
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

function RequestSnapshot({
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

function ActionCard({
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

function ResultSummaryCard({
	latestAttempt,
	liveFlow,
}: {
	latestAttempt: AttemptRecord | undefined
	liveFlow: LiveFlowState
}) {
	if (liveFlow.isLoading) {
		return (
			<div className="rounded-[26px] border border-[color:rgba(65,126,56,0.3)] bg-[color:rgba(65,126,56,0.12)] p-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-[0.24em] text-slate-400">
							Processamento em andamento
						</p>
						<h3 className="font-display text-2xl text-white">{liveFlow.title}</h3>
						<p className="max-w-2xl text-sm leading-6 text-slate-300">{liveFlow.description}</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<StageBadge stage={liveFlow.stage} />
						{liveFlow.actionType ? <ActionBadge actionType={liveFlow.actionType} /> : null}
					</div>
				</div>

				<div className="mt-4 grid gap-3 sm:grid-cols-3">
					<MonitorMeta
						label="Chave em uso"
						value={liveFlow.idempotencyKey ?? 'Aguardando a próxima requisição'}
					/>
					<MonitorMeta
						label="Progresso"
						value={`${liveFlow.completedRequests}/${liveFlow.totalRequests || 0} concluídas`}
					/>
					<MonitorMeta
						label="Atualizado"
						value={liveFlow.updatedAt ? formatTimestamp(liveFlow.updatedAt) : 'Agora mesmo'}
					/>
				</div>
			</div>
		)
	}

	if (!latestAttempt) {
		return (
			<div className="rounded-[26px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-5">
				<p className="text-xs uppercase tracking-[0.24em] text-slate-500">Resultado simplificado</p>
				<h3 className="mt-3 font-display text-2xl text-white">Ainda não houve resposta.</h3>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
					Escolha um teste acima. Assim que a API responder, este bloco vai explicar o que aconteceu
					e o que vale testar em seguida.
				</p>
			</div>
		)
	}

	return (
		<div className="rounded-[26px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-panel)] p-5">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-2">
					<p className="text-xs uppercase tracking-[0.24em] text-slate-500">
						Resumo da última resposta
					</p>
					<h3 className="font-display text-2xl text-white">{latestAttempt.headline}</h3>
					<p className="max-w-2xl text-sm leading-6 text-slate-300">{latestAttempt.detail}</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<OutcomeBadge outcome={latestAttempt.outcome} />
					<ResultModeBadge attempt={latestAttempt} />
					<ActionBadge actionType={latestAttempt.actionType} />
				</div>
			</div>

			<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<MonitorMeta
					label="HTTP"
					value={latestAttempt.httpStatus !== null ? String(latestAttempt.httpStatus) : '—'}
				/>
				<MonitorMeta label="Modo" value={formatResultModeLabel(latestAttempt)} />
				<MonitorMeta label="Duração" value={formatDuration(latestAttempt.elapsedMs)} />
				<MonitorMeta label="Atualizado" value={formatTimestamp(latestAttempt.updatedAt)} />
			</div>

			<div className="mt-4 rounded-[22px] border border-[color:var(--color-border-faint)] bg-[color:rgba(13,18,28,0.78)] p-4">
				<p className="text-xs uppercase tracking-[0.22em] text-slate-500">Próximo passo sugerido</p>
				<p className="mt-2 text-sm leading-6 text-slate-200">{getNextSuggestion(latestAttempt)}</p>
			</div>
		</div>
	)
}

function CurrentStatusCard({
	latestAttempt,
	liveFlow,
	requestCount,
}: {
	latestAttempt: AttemptRecord | undefined
	liveFlow: LiveFlowState
	requestCount: number
}) {
	const insightTitle = latestAttempt
		? latestAttempt.headline
		: liveFlow.isLoading
			? 'O sistema está trabalhando nesta chave'
			: 'Ainda não há eventos para interpretar'
	const insightDescription = latestAttempt
		? latestAttempt.detail
		: liveFlow.isLoading
			? liveFlow.description
			: 'Assim que você executar um teste, este painel traduz o comportamento da API em uma leitura rápida.'

	return (
		<div className="space-y-5">
			<div className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-panel)] p-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-[0.24em] text-slate-500">
							Estado atual da chave
						</p>
						<h3 className="font-display text-2xl text-slate-50">{liveFlow.title}</h3>
						<p className="max-w-2xl text-sm leading-6 text-slate-300">{liveFlow.description}</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<StageBadge stage={liveFlow.stage} />
						{liveFlow.actionType ? <ActionBadge actionType={liveFlow.actionType} /> : null}
					</div>
				</div>

				<div className="mt-5">
					<LifecycleRail stage={liveFlow.stage} />
				</div>

				<div className="mt-5 grid gap-3 sm:grid-cols-2">
					<MonitorMeta
						label="Chave de idempotência"
						value={liveFlow.idempotencyKey ?? 'Aguardando a próxima requisição'}
					/>
					<MonitorMeta
						label="Progresso"
						value={`${liveFlow.completedRequests}/${liveFlow.totalRequests || 0} concluídas`}
					/>
					<MonitorMeta label="Tentativas observadas" value={String(requestCount)} />
					<MonitorMeta
						label="Atualizado"
						value={liveFlow.updatedAt ? formatTimestamp(liveFlow.updatedAt) : 'Inativo'}
					/>
				</div>
			</div>

			<div className="rounded-[24px] border border-[color:rgba(65,126,56,0.3)] bg-[color:rgba(65,126,56,0.12)] p-5">
				<p className="text-xs uppercase tracking-[0.24em] text-slate-400">Leitura humana</p>
				<h3 className="mt-3 font-display text-xl text-white">{insightTitle}</h3>
				<p className="mt-2 text-sm leading-6 text-slate-200">{insightDescription}</p>
			</div>
		</div>
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
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
	const number = getScenarioNumber(scenario.title)
	const title = getScenarioTitle(scenario.title)

	return (
		<article className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-panel)] p-5 transition-all duration-300">
			<div className="flex items-start justify-between gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] text-sm font-semibold text-slate-100">
					{number}
				</div>
				<ScenarioStatusBadge status={scenario.status} />
			</div>

			<h3 className="mt-4 font-display text-xl text-slate-50">{title}</h3>
			<p className="mt-2 text-sm leading-6 text-slate-400">{scenario.description}</p>

			<div className="mt-4 rounded-[22px] border border-[color:var(--color-border-faint)] bg-[color:rgba(13,18,28,0.78)] p-4">
				<p className="text-xs uppercase tracking-[0.22em] text-slate-500">
					O que a interface mostra
				</p>
				<p className="mt-2 text-sm leading-6 text-slate-200">{scenario.message}</p>
			</div>

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

function HistoryMeta({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-[color:var(--color-border-faint)] bg-[color:var(--color-surface-muted)] px-3 py-3">
			<p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
			<p className="mt-2 break-all text-sm text-slate-100">{value}</p>
		</div>
	)
}

function ActionBadge({ actionType }: { actionType: AttemptActionType }) {
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
	if (attempt.httpStatus === 0) {
		return <Badge variant="destructive">Falha de conexão</Badge>
	}

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
		return <Badge variant="pending">Em teste</Badge>
	}

	return <Badge variant="neutral">Pronto para testar</Badge>
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

function formatActionTypeLabel(value: AttemptActionType) {
	return {
		CONCURRENT: 'CONCORRÊNCIA',
		CREATE: 'CRIAÇÃO',
		REPLAY: 'REPETIÇÃO',
	}[value]
}

function formatResultModeLabel(attempt: AttemptRecord) {
	if (attempt.httpStatus === 0) {
		return 'Falha de conexão'
	}

	return {
		FRESH: 'Processado agora',
		REUSED: 'Resposta armazenada',
		SHARED: 'Resultado compartilhado',
		WAITING: 'Aguardando conclusão',
	}[attempt.resultMode]
}

function formatMetricTimestamp(value: string) {
	return new Intl.DateTimeFormat('pt-BR', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(value))
}

function formatAmountPreview(value: string) {
	if (!value.trim()) {
		return 'Não informado'
	}

	const numericValue = Number(value)

	if (!Number.isFinite(numericValue)) {
		return 'Valor inválido'
	}

	return new Intl.NumberFormat('pt-BR', {
		style: 'currency',
		currency: 'BRL',
	}).format(numericValue)
}

function getNextSuggestion(attempt: AttemptRecord) {
	if (attempt.httpStatus === 0) {
		return 'A interface não conseguiu completar a chamada. Verifique se a API está disponível e tente novamente antes de validar os cenários de idempotência.'
	}

	if (attempt.resultMode === 'SHARED' || attempt.actionType === 'CONCURRENT') {
		return 'Abra o histórico para comparar as duas tentativas paralelas e confirmar que ambas convergiram para o mesmo desfecho.'
	}

	if (attempt.resultMode === 'REUSED' && attempt.outcome === 'SUCCESS') {
		return 'Agora gere uma nova chave se quiser forçar um processamento novo, ou use o histórico para validar que esta resposta veio do armazenamento.'
	}

	if (attempt.resultMode === 'REUSED' && attempt.outcome === 'FAILED') {
		return 'Este é o caso clássico de falha persistida. Gere uma nova chave apenas se quiser tentar um processamento totalmente novo.'
	}

	if (attempt.resultMode === 'WAITING' || attempt.outcome === 'PENDING') {
		return 'Acompanhe o painel ao vivo: enquanto a chave estiver pendente, novas chamadas com ela podem continuar retornando o estado em andamento.'
	}

	if (attempt.outcome === 'SUCCESS') {
		return 'Repita a mesma chave para provar visualmente que a API devolve o SUCESSO persistido sem reprocessamento.'
	}

	if (attempt.outcome === 'FAILED') {
		return 'Repita a mesma chave para confirmar que a FALHA também é persistida e não dispara uma nova execução.'
	}

	return 'Abra o histórico técnico para validar request id, duração e o JSON completo da resposta.'
}

function getScenarioNumber(title: string) {
	const match = title.match(/Cenário\s+(\d+)/i)

	return match?.[1] ?? '•'
}

function getScenarioTitle(title: string) {
	const parts = title.split('—')

	return parts.length > 1 ? parts.slice(1).join('—').trim() : title
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
