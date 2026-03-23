import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '../../../components/ui/card'
import type { AttemptRecord, LiveFlowState, ScenarioCardState } from '../model'
import { formatTimestamp } from '../model'
import { getScenarioNumber, getScenarioTitle, isStepComplete } from '../utils/presentation'
import { MonitorMeta } from './shared'
import { ActionBadge, ScenarioStatusBadge, StageBadge } from './status-badges'

interface LiveMonitorSectionProps {
	latestAttempt: AttemptRecord | undefined
	liveFlow: LiveFlowState
	requestCount: number
	scenarios: ScenarioCardState[]
}

export function LiveMonitorSection({
	latestAttempt,
	liveFlow,
	requestCount,
	scenarios,
}: LiveMonitorSectionProps) {
	return (
		<section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
			<Card className="reveal">
				<CardHeader className="gap-3">
					<CardTitle>Acompanhe ao vivo</CardTitle>
					<CardDescription>
						Este painel mostra o estado atual da chave, a etapa do ciclo de vida e a leitura do que
						a API acabou de fazer.
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

function LifecycleRail({ stage }: { stage: LiveFlowState['stage'] }) {
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

function ScenarioCard({ scenario }: { scenario: ScenarioCardState }) {
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
