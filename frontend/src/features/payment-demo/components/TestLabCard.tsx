import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import type {
	AttemptRecord,
	LiveFlowState,
	PaymentFormState,
	PaymentRequestPayload,
} from '../model'
import { formatDuration, formatTimestamp } from '../model'
import { formatResultModeLabel, getNextSuggestion } from '../utils/presentation'
import { ActionCard, Field, JsonPanel, MonitorMeta, RequestSnapshot, SectionLead } from './shared'
import { ActionBadge, OutcomeBadge, ResultModeBadge, StageBadge } from './status-badges'

interface TestLabCardProps {
	errorMessage: string | null
	form: PaymentFormState
	isBusy: boolean
	latestAttempt: AttemptRecord | undefined
	liveFlow: LiveFlowState
	onCreatePayment: () => void
	onReplayRequest: () => void
	onConcurrentRequests: () => void
	onRefreshIdempotencyKey: () => void
	onSetFormField: <Key extends keyof PaymentFormState>(
		key: Key,
		value: PaymentFormState[Key],
	) => void
	requestPayload: PaymentRequestPayload
}

export function TestLabCard({
	errorMessage,
	form,
	isBusy,
	latestAttempt,
	liveFlow,
	onConcurrentRequests,
	onCreatePayment,
	onRefreshIdempotencyKey,
	onReplayRequest,
	onSetFormField,
	requestPayload,
}: TestLabCardProps) {
	return (
		<Card className="reveal">
			<CardHeader className="gap-3">
				<CardTitle>Teste agora</CardTitle>
				<CardDescription>
					Monte a requisição, escolha o experimento e veja uma explicação humana do retorno antes do
					JSON técnico.
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
								onChange={(event) => onSetFormField('amount', event.target.value)}
								placeholder="100"
								value={form.amount}
							/>
						</Field>
						<Field htmlFor="payment-customer-id" label="ID do cliente">
							<Input
								id="payment-customer-id"
								onChange={(event) => onSetFormField('customerId', event.target.value)}
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
									onChange={(event) => onSetFormField('idempotencyKey', event.target.value)}
									placeholder="pagamento-demo-001"
									value={form.idempotencyKey}
								/>
								<Button
									className="shrink-0"
									disabled={isBusy}
									onClick={onRefreshIdempotencyKey}
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
							onClick={onCreatePayment}
							title="Fluxo normal"
							variant="default"
						/>
						<ActionCard
							buttonLabel="Repetir a mesma requisição"
							description="Usa a mesma chave para provar que a resposta persistida é reutilizada."
							isBusy={isBusy}
							isLoading={isBusy && liveFlow.actionType === 'REPLAY'}
							loadingLabel="Repetindo..."
							onClick={onReplayRequest}
							title="Idempotência"
							variant="outline"
						/>
						<ActionCard
							buttonLabel="Simular duas chamadas paralelas"
							description="Dispara duas requisições simultâneas com a mesma chave para comparar o desfecho."
							isBusy={isBusy}
							isLoading={isBusy && liveFlow.actionType === 'CONCURRENT'}
							loadingLabel="Executando fluxo paralelo..."
							onClick={onConcurrentRequests}
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
