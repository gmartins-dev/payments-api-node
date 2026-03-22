export interface PaymentFormState {
	amount: string
	customerId: string
	idempotencyKey: string
}

export interface PaymentRequestPayload {
	amount: number
	customerId: string
}

export type AttemptActionType = 'CREATE' | 'REPLAY' | 'CONCURRENT'
export type AttemptLifecycleStage = 'REQUEST_CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED'
export type LiveFlowStage = 'IDLE' | AttemptLifecycleStage
export type PaymentOutcome = 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED'
export type AttemptResultMode = 'FRESH' | 'REUSED' | 'SHARED' | 'WAITING'
export type ScenarioId =
	| 'CONCURRENT_REQUESTS'
	| 'RETRY_AFTER_SUCCESS'
	| 'RETRY_AFTER_FAILURE'
	| 'REQUEST_DURING_PROCESSING'
export type ScenarioCardStatus = 'idle' | 'active' | 'observed'

export interface PaymentResponseBody {
	status?: unknown
	paymentId?: unknown
	reason?: unknown
	amount?: unknown
	customerId?: unknown
	[key: string]: unknown
}

export interface PaymentResponse {
	body: PaymentResponseBody
	requestId: string | null
	status: number
}

export interface AttemptRecord {
	id: string
	batchId: string
	label: string
	actionType: AttemptActionType
	requestIndex: number | null
	requestPayload: PaymentRequestPayload
	idempotencyKey: string
	httpStatus: number | null
	body: PaymentResponseBody | null
	requestId: string | null
	createdAt: string
	updatedAt: string
	completedAt: string | null
	elapsedMs: number | null
	lifecycleStage: AttemptLifecycleStage
	outcome: PaymentOutcome
	resultMode: AttemptResultMode
	headline: string
	detail: string
	scenarioIds: ScenarioId[]
	isLoading: boolean
	pollCount: number
}

export interface AttemptGroup {
	idempotencyKey: string
	attempts: AttemptRecord[]
	latestAt: string
	totalRequests: number
	latestOutcome: PaymentOutcome
	hasReplay: boolean
	hasSharedOutcome: boolean
}

export interface ScenarioCardState {
	id: ScenarioId
	title: string
	description: string
	status: ScenarioCardStatus
	message: string
	observedAt: string | null
}

export interface LiveFlowState {
	title: string
	description: string
	stage: LiveFlowStage
	isLoading: boolean
	idempotencyKey: string | null
	actionType: AttemptActionType | null
	startedAt: string | null
	updatedAt: string | null
	totalRequests: number
	completedRequests: number
}

export const scenarioDefinitions: Record<
	ScenarioId,
	{ title: string; description: string; idleMessage: string }
> = {
	CONCURRENT_REQUESTS: {
		title: 'Scenario 1 — Concurrent Requests',
		description:
			'Send two same-key requests in parallel and verify they converge on one stored result.',
		idleMessage: 'Run the concurrency simulation to compare two parallel requests side by side.',
	},
	RETRY_AFTER_SUCCESS: {
		title: 'Scenario 2 — Retry After Success',
		description:
			'Replay a completed successful payment and confirm the backend reuses the saved response.',
		idleMessage:
			'Create a successful payment, then replay the same key to observe the persisted SUCCESS.',
	},
	RETRY_AFTER_FAILURE: {
		title: 'Scenario 3 — Retry After Failure',
		description:
			'Replay a failed payment and confirm the backend does not execute a new processing attempt.',
		idleMessage: 'When a payment fails, replay the same key to observe the persisted FAILURE.',
	},
	REQUEST_DURING_PROCESSING: {
		title: 'Scenario 4 — Request During Processing',
		description:
			'Issue a same-key request while the original request is still in flight and monitor the PENDING path.',
		idleMessage:
			'When the same key is requested while processing is active, the UI will surface the in-progress state.',
	},
}

export const initialFormState: PaymentFormState = {
	amount: '100',
	customerId: 'customer-1',
	idempotencyKey: createIdempotencyKey(),
}

export function createIdempotencyKey() {
	return `payment-${crypto.randomUUID().slice(0, 8)}`
}

export function createScenarioState(): Record<ScenarioId, ScenarioCardState> {
	return {
		CONCURRENT_REQUESTS: toScenarioCardState('CONCURRENT_REQUESTS'),
		RETRY_AFTER_SUCCESS: toScenarioCardState('RETRY_AFTER_SUCCESS'),
		RETRY_AFTER_FAILURE: toScenarioCardState('RETRY_AFTER_FAILURE'),
		REQUEST_DURING_PROCESSING: toScenarioCardState('REQUEST_DURING_PROCESSING'),
	}
}

export function createIdleFlowState(): LiveFlowState {
	return {
		title: 'No request in progress',
		description:
			'Create a payment or replay the same key to inspect idempotency and concurrency behavior.',
		stage: 'IDLE',
		isLoading: false,
		idempotencyKey: null,
		actionType: null,
		startedAt: null,
		updatedAt: null,
		totalRequests: 0,
		completedRequests: 0,
	}
}

export function toRequestPayload(form: PaymentFormState): PaymentRequestPayload {
	const parsedAmount = Number(form.amount)

	return {
		amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
		customerId: form.customerId,
	}
}

export function getOutcomeFromResponse(response: PaymentResponse): PaymentOutcome {
	const bodyStatus = getBodyStatus(response.body)

	if (response.status === 202 || bodyStatus === 'PENDING') {
		return 'PENDING'
	}

	if (bodyStatus === 'FAILED' || response.status >= 400) {
		return 'FAILED'
	}

	if (bodyStatus === 'SUCCESS' || response.status < 400) {
		return 'SUCCESS'
	}

	return 'IDLE'
}

export function getBodyStatus(body: PaymentResponseBody | null): PaymentOutcome | null {
	const value = body?.status

	if (value === 'SUCCESS' || value === 'FAILED' || value === 'PENDING') {
		return value
	}

	return null
}

export function isTerminalOutcome(outcome: PaymentOutcome) {
	return outcome === 'SUCCESS' || outcome === 'FAILED'
}

export function findLatestTerminalAttempt(
	attempts: AttemptRecord[],
	idempotencyKey: string,
): AttemptRecord | null {
	return (
		sortAttemptsByRecentActivity(attempts).find(
			(attempt) => attempt.idempotencyKey === idempotencyKey && isTerminalOutcome(attempt.outcome),
		) ?? null
	)
}

export function sortAttemptsByRecentActivity(attempts: AttemptRecord[]) {
	return [...attempts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function groupAttemptsByKey(attempts: AttemptRecord[]): AttemptGroup[] {
	const grouped = new Map<string, AttemptRecord[]>()

	for (const attempt of sortAttemptsByRecentActivity(attempts)) {
		const current = grouped.get(attempt.idempotencyKey) ?? []
		current.push(attempt)
		grouped.set(attempt.idempotencyKey, current)
	}

	return Array.from(grouped.entries())
		.map(([idempotencyKey, records]) => {
			const latest = records[0]

			return {
				idempotencyKey,
				attempts: [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
				latestAt: latest?.updatedAt ?? '',
				totalRequests: records.length,
				latestOutcome: latest?.outcome ?? 'IDLE',
				hasReplay: records.some((record) => record.resultMode === 'REUSED'),
				hasSharedOutcome: records.some((record) => record.resultMode === 'SHARED'),
			} satisfies AttemptGroup
		})
		.sort((left, right) => right.latestAt.localeCompare(left.latestAt))
}

export function haveSameFinalResult(left: AttemptRecord, right: AttemptRecord) {
	return (
		left.httpStatus === right.httpStatus && JSON.stringify(left.body) === JSON.stringify(right.body)
	)
}

export function formatJson(value: unknown) {
	return JSON.stringify(value, null, 2)
}

export function formatTimestamp(value: string | null) {
	if (!value) {
		return 'Not available yet'
	}

	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'medium',
	}).format(new Date(value))
}

export function formatDuration(value: number | null) {
	if (value === null) {
		return 'Pending'
	}

	if (value < 1000) {
		return `${value} ms`
	}

	return `${(value / 1000).toFixed(2)} s`
}

export function validateForm(form: PaymentFormState) {
	if (!form.idempotencyKey.trim()) {
		return 'Idempotency key is required.'
	}

	if (!form.customerId.trim()) {
		return 'Customer ID is required.'
	}

	const amount = Number(form.amount)
	if (!Number.isFinite(amount) || amount <= 0) {
		return 'Amount must be a positive number.'
	}

	return null
}

function toScenarioCardState(id: ScenarioId): ScenarioCardState {
	const definition = scenarioDefinitions[id]

	return {
		id,
		title: definition.title,
		description: definition.description,
		status: 'idle',
		message: definition.idleMessage,
		observedAt: null,
	}
}
