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
		<main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.15),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.15),_transparent_34%),var(--color-page)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
			<div className="mx-auto flex max-w-7xl flex-col gap-6">
				<section className="reveal rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(15,23,42,0.64))] p-8 shadow-[0_30px_120px_rgba(2,6,23,0.45)] backdrop-blur-xl">
					<div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
						<div className="max-w-3xl space-y-4">
							<p className="text-xs font-semibold uppercase tracking-[0.38em] text-[var(--color-accent)]">
								Payment Idempotency Demo
							</p>
							<h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
								One key, one persisted outcome, no duplicate processing.
							</h1>
							<p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
								Inspect the full request lifecycle, replay the same idempotency key, and compare
								parallel requests without leaving the UI.
							</p>
						</div>

						<div className="flex w-full flex-col gap-4 xl:max-w-3xl xl:items-end">
							<Button asChild className="self-start xl:self-auto" size="sm" variant="outline">
								<a href={apiDocsUrl} rel="noreferrer" target="_blank">
									API Docs
								</a>
							</Button>

							<div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-5">
								<Metric label="Backend target" value={apiUrl.replace(/^https?:\/\//, '')} />
								<Metric label="Latest outcome" value={formatStageLabel(latestOutcome)} />
								<Metric label="Response time" value={formatDuration(latestResponseTime)} />
								<Metric
									label="Requests"
									value={String(
										groupedAttempts.reduce((sum, group) => sum + group.totalRequests, 0),
									)}
								/>
								<Metric
									label="Last updated"
									value={lastUpdated ? formatTimestamp(lastUpdated) : 'No requests yet'}
								/>
							</div>
						</div>
					</div>
				</section>

				<section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
					<Card className="reveal">
						<CardHeader>
							<CardTitle>Payment playground</CardTitle>
							<CardDescription>
								Use the same idempotency key to prove persisted replay or send two requests in
								parallel to inspect concurrency safety.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid gap-4 md:grid-cols-3">
								<Field htmlFor="payment-amount" label="Amount">
									<Input
										id="payment-amount"
										inputMode="decimal"
										onChange={(event) => setFormField('amount', event.target.value)}
										placeholder="100"
										value={form.amount}
									/>
								</Field>
								<Field htmlFor="payment-customer-id" label="Customer ID">
									<Input
										id="payment-customer-id"
										onChange={(event) => setFormField('customerId', event.target.value)}
										placeholder="customer-1"
										value={form.customerId}
									/>
								</Field>
								<Field
									description="Same key = same result (idempotent)"
									htmlFor="payment-idempotency-key"
									label="Idempotency key"
								>
									<div className="flex gap-2">
										<Input
											className="flex-1"
											id="payment-idempotency-key"
											onChange={(event) => setFormField('idempotencyKey', event.target.value)}
											placeholder="payment-demo-001"
											value={form.idempotencyKey}
										/>
										<Button
											className="shrink-0"
											disabled={isBusy}
											onClick={refreshIdempotencyKey}
											size="sm"
											variant="outline"
										>
											New key
										</Button>
									</div>
								</Field>
							</div>

							<div className="flex flex-col gap-3 md:flex-row">
								<Button className="md:flex-1" disabled={isBusy} onClick={handleCreatePayment}>
									<ButtonLabel
										isLoading={isBusy && liveFlow.actionType === 'CREATE'}
										label="Create payment"
										loadingLabel="Processing..."
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
										label="Replay same request (same key)"
										loadingLabel="Replaying..."
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
										label="Simulate concurrency (2 parallel requests)"
										loadingLabel="Running parallel flow..."
									/>
								</Button>
							</div>

							{errorMessage ? (
								<div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
									{errorMessage}
								</div>
							) : null}

							<div className="grid gap-4 lg:grid-cols-2">
								<JsonPanel
									caption="Current request payload"
									title="Request payload"
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
											: 'No response yet'
									}
									title="Latest response body"
									value={latestAttempt?.body ?? { status: 'IDLE' }}
								/>
							</div>
						</CardContent>
					</Card>

					<Card className="reveal">
						<CardHeader>
							<CardTitle>Behavior monitor</CardTitle>
							<CardDescription>
								The UI tracks lifecycle transitions, persisted replays, and the four key idempotency
								scenarios as they happen.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div className="space-y-2">
										<p className="text-xs uppercase tracking-[0.24em] text-slate-500">
											Live request lifecycle
										</p>
										<h3 className="font-display text-2xl text-slate-50">{liveFlow.title}</h3>
										<p className="max-w-xl text-sm leading-6 text-slate-300">
											{liveFlow.description}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<StageBadge stage={liveFlow.stage} />
										{liveFlow.actionType ? (
											<Badge variant="neutral">{liveFlow.actionType}</Badge>
										) : null}
									</div>
								</div>

								<div className="mt-5">
									<LifecycleRail stage={liveFlow.stage} />
								</div>

								<div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
									<MonitorMeta
										label="Idempotency key"
										value={liveFlow.idempotencyKey ?? 'Waiting for the next request'}
									/>
									<MonitorMeta
										label="Requests settled"
										value={
											liveFlow.totalRequests > 0
												? `${liveFlow.completedRequests}/${liveFlow.totalRequests}`
												: '0/0'
										}
									/>
									<MonitorMeta
										label="Updated"
										value={liveFlow.updatedAt ? formatTimestamp(liveFlow.updatedAt) : 'Idle'}
									/>
								</div>
							</div>

							<div className="rounded-[24px] border border-cyan-400/16 bg-cyan-500/8 p-5">
								<p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">
									Latest insight
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
										Create a payment to see the request lifecycle, replay indicators, and
										concurrency insights fill in.
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
						<CardTitle>Attempt history</CardTitle>
						<CardDescription>
							Group requests by idempotency key and inspect whether each response was freshly
							processed, replayed from storage, or shared by concurrent requests.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{groupedAttempts.length === 0 ? (
							<div className="rounded-[24px] border border-dashed border-white/12 bg-slate-950/50 p-6 text-sm leading-6 text-slate-400">
								No requests yet. Create a payment to see idempotency in action.
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
		<div className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p className="text-xs uppercase tracking-[0.24em] text-slate-500">{caption}</p>
					<h3 className="mt-3 font-display text-xl text-slate-50">{title}</h3>
				</div>
				{badges}
			</div>
			<div className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
				<pre>{formatJson(value)}</pre>
			</div>
		</div>
	)
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4">
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
		{ key: 'REQUEST_CREATED', label: 'Request created' },
		{ key: 'PENDING', label: 'Pending' },
		{ key: 'SUCCESS', label: 'Success' },
		{ key: 'FAILED', label: 'Failed' },
	] as const

	return (
		<div className="grid gap-3 sm:grid-cols-4">
			{steps.map((step, index) => {
				const isActive = stage === step.key
				const isComplete = isStepComplete(stage, step.key)

				return (
					<div
						className="rounded-[22px] border border-white/10 bg-slate-950/80 p-4 transition-all duration-300"
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
											: 'border-white/10 bg-white/6 text-slate-500',
								].join(' ')}
							>
								{index + 1}
							</div>
							<div>
								<p className="text-xs uppercase tracking-[0.24em] text-slate-500">
									Step {index + 1}
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
		<div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
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
		<article className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5 transition-all duration-300">
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
					? `Updated ${formatTimestamp(scenario.observedAt)}`
					: 'Waiting to observe'}
			</p>
		</article>
	)
}

function AttemptGroupCard({ group }: { group: AttemptGroup }) {
	return (
		<article className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_18px_40px_rgba(2,6,23,0.3)] history-enter">
			<div className="flex flex-col gap-4 border-b border-white/8 pb-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-2">
					<p className="text-xs uppercase tracking-[0.24em] text-slate-500">Idempotency key</p>
					<h3 className="break-all font-display text-2xl text-white">{group.idempotencyKey}</h3>
					<p className="text-sm leading-6 text-slate-400">
						{group.totalRequests} request{group.totalRequests === 1 ? '' : 's'} • last updated{' '}
						{formatTimestamp(group.latestAt)}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<OutcomeBadge outcome={group.latestOutcome} />
					{group.hasReplay ? <Badge variant="info">Persisted replay</Badge> : null}
					{group.hasSharedOutcome ? <Badge variant="info">Shared outcome</Badge> : null}
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
		<section className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4 transition-all duration-300">
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
					<HistoryMeta label="Started" value={formatTimestamp(attempt.createdAt)} />
					<HistoryMeta label="Elapsed" value={formatDuration(attempt.elapsedMs)} />
					<HistoryMeta label="Request ID" value={attempt.requestId ?? 'Pending or unavailable'} />
					<HistoryMeta
						label="Polling"
						value={
							attempt.pollCount > 0
								? `${attempt.pollCount} follow-up request${attempt.pollCount === 1 ? '' : 's'}`
								: 'No client polling'
						}
					/>
				</div>
			</div>

			<details
				className="mt-4 rounded-[22px] border border-white/8 bg-slate-950/70 p-4"
				open={defaultOpen}
			>
				<summary className="cursor-pointer list-none text-sm font-medium text-slate-100 [&::-webkit-details-marker]:hidden">
					View payload and response JSON
				</summary>
				<div className="mt-4 grid gap-4 xl:grid-cols-2">
					<div>
						<p className="text-xs uppercase tracking-[0.22em] text-slate-500">Request payload</p>
						<div className="mt-2 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
							<pre>{formatJson(attempt.requestPayload)}</pre>
						</div>
					</div>
					<div>
						<p className="text-xs uppercase tracking-[0.22em] text-slate-500">Response body</p>
						<div className="mt-2 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
							<pre>{formatJson(attempt.body ?? { status: 'PENDING' })}</pre>
						</div>
					</div>
				</div>
			</details>
		</section>
	)
}

function HistoryMeta({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
			<p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
			<p className="mt-2 break-all text-sm text-slate-100">{value}</p>
		</div>
	)
}

function ActionBadge({ actionType }: { actionType: AttemptRecord['actionType'] }) {
	return <Badge variant="neutral">{actionType}</Badge>
}

function OutcomeBadge({ outcome }: { outcome: 'FAILED' | 'IDLE' | 'PENDING' | 'SUCCESS' }) {
	if (outcome === 'SUCCESS') {
		return <Badge variant="success">SUCCESS</Badge>
	}

	if (outcome === 'FAILED') {
		return <Badge variant="destructive">FAILED</Badge>
	}

	if (outcome === 'PENDING') {
		return <Badge variant="pending">PENDING</Badge>
	}

	return <Badge variant="neutral">IDLE</Badge>
}

function ResultModeBadge({ attempt }: { attempt: AttemptRecord }) {
	if (attempt.resultMode === 'REUSED') {
		return <Badge variant="info">Reused result</Badge>
	}

	if (attempt.resultMode === 'SHARED') {
		return <Badge variant="info">Shared outcome</Badge>
	}

	if (attempt.resultMode === 'WAITING') {
		return <Badge variant="pending">Processing</Badge>
	}

	return <Badge variant="success">Processed</Badge>
}

function StageBadge({
	stage,
}: {
	stage: 'FAILED' | 'IDLE' | 'PENDING' | 'REQUEST_CREATED' | 'SUCCESS'
}) {
	if (stage === 'FAILED') {
		return <Badge variant="destructive">FAILED</Badge>
	}

	if (stage === 'SUCCESS') {
		return <Badge variant="success">SUCCESS</Badge>
	}

	if (stage === 'PENDING') {
		return <Badge variant="pending">PENDING</Badge>
	}

	if (stage === 'REQUEST_CREATED') {
		return <Badge variant="info">REQUEST CREATED</Badge>
	}

	return <Badge variant="neutral">IDLE</Badge>
}

function ScenarioStatusBadge({ status }: { status: 'active' | 'idle' | 'observed' }) {
	if (status === 'observed') {
		return <Badge variant="info">Observed</Badge>
	}

	if (status === 'active') {
		return <Badge variant="pending">Active</Badge>
	}

	return <Badge variant="neutral">Ready</Badge>
}

function Spinner() {
	return (
		<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
	)
}

function formatStageLabel(value: string) {
	return value.replaceAll('_', ' ')
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
