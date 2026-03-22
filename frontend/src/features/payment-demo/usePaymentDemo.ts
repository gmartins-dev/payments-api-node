import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'

import {
	type AttemptActionType,
	type AttemptRecord,
	type AttemptResultMode,
	createIdempotencyKey,
	createIdleFlowState,
	createScenarioState,
	findLatestTerminalAttempt,
	getOutcomeFromResponse,
	groupAttemptsByKey,
	haveSameFinalResult,
	initialFormState,
	isTerminalOutcome,
	type LiveFlowState,
	type PaymentFormState,
	type PaymentOutcome,
	type PaymentRequestPayload,
	type PaymentResponse,
	type ScenarioCardState,
	type ScenarioCardStatus,
	type ScenarioId,
	sortAttemptsByRecentActivity,
	toRequestPayload,
	validateForm,
} from './model'

const CLIENT_POLL_INTERVAL_MS = 700
const CLIENT_POLL_MAX_ATTEMPTS = 4
const LIVE_PENDING_DELAY_MS = 180
const PERSISTED_REPLAY_THRESHOLD_MS = 700

interface ExecuteAttemptParams {
	actionType: AttemptActionType
	batchId: string
	idempotencyKey: string
	label: string
	payload: PaymentRequestPayload
	requestIndex: number | null
	totalRequests: number
}

interface AttemptExecutionContext extends ExecuteAttemptParams {
	attemptId: string
	priorTerminal: AttemptRecord | null
	startedAtMs: number
	startedIso: string
	startedWhilePending: boolean
	sawPending: boolean
}

interface AttemptExecutionResult {
	outcome: PaymentOutcome
	status: number
}

export function usePaymentDemo(apiUrl: string) {
	const [form, setForm] = useState<PaymentFormState>(initialFormState)
	const [attempts, setAttempts] = useState<AttemptRecord[]>([])
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [liveFlow, setLiveFlow] = useState<LiveFlowState>(createIdleFlowState)
	const [scenarioState, setScenarioState] =
		useState<Record<ScenarioId, ScenarioCardState>>(createScenarioState)

	const attemptsRef = useRef<AttemptRecord[]>([])
	const activeKeyCountsRef = useRef<Map<string, number>>(new Map())
	const concurrentBatchIdRef = useRef<string | null>(null)

	useEffect(() => {
		attemptsRef.current = attempts
	}, [attempts])

	const concurrencyBatchVersion = useMemo(
		() =>
			attempts
				.map((attempt) => `${attempt.id}:${attempt.updatedAt}:${attempt.isLoading}`)
				.join('|'),
		[attempts],
	)

	useEffect(() => {
		void concurrencyBatchVersion
		const batchId = concurrentBatchIdRef.current

		if (!batchId || liveFlow.actionType !== 'CONCURRENT' || !liveFlow.isLoading) {
			return
		}

		finalizeConcurrentBatch(batchId)
	}, [concurrencyBatchVersion, liveFlow.actionType, liveFlow.isLoading])

	const requestPayload = useMemo(() => toRequestPayload(form), [form])
	const groupedAttempts = useMemo(() => groupAttemptsByKey(attempts), [attempts])
	const latestAttempt = useMemo(() => sortAttemptsByRecentActivity(attempts)[0] ?? null, [attempts])
	const scenarios = useMemo(
		() => [
			scenarioState.CONCURRENT_REQUESTS,
			scenarioState.RETRY_AFTER_SUCCESS,
			scenarioState.RETRY_AFTER_FAILURE,
			scenarioState.REQUEST_DURING_PROCESSING,
		],
		[scenarioState],
	)
	const isBusy = useMemo(
		() => liveFlow.isLoading || attempts.some((attempt) => attempt.isLoading),
		[attempts, liveFlow.isLoading],
	)

	async function handleCreatePayment() {
		await runSingleAction({
			actionType: 'CREATE',
			label: 'Create payment',
		})
	}

	async function handleReplaySameRequest() {
		await runSingleAction({
			actionType: 'REPLAY',
			label: 'Replay same request (same key)',
		})
	}

	async function handleConcurrentRequests() {
		const validationError = validateForm(form)
		if (validationError) {
			setErrorMessage(validationError)
			return
		}

		const startedIso = new Date().toISOString()
		const batchId = crypto.randomUUID()
		concurrentBatchIdRef.current = batchId
		const pendingTimer = schedulePendingFlow(
			'Both requests are in flight. Watch for a shared result or an intermediate PENDING replay.',
		)

		setErrorMessage(null)
		setLiveFlow({
			title: 'Simulate concurrency (2 parallel requests)',
			description: 'Dispatching 2 parallel requests with the same idempotency key.',
			stage: 'REQUEST_CREATED',
			isLoading: true,
			idempotencyKey: form.idempotencyKey,
			actionType: 'CONCURRENT',
			startedAt: startedIso,
			updatedAt: startedIso,
			totalRequests: 2,
			completedRequests: 0,
		})
		updateScenario(
			'CONCURRENT_REQUESTS',
			'active',
			'Dispatching 2 parallel requests with the same idempotency key.',
			startedIso,
		)

		try {
			await Promise.all([
				executeAttempt({
					actionType: 'CONCURRENT',
					batchId,
					idempotencyKey: form.idempotencyKey,
					label: 'Parallel request A',
					payload: requestPayload,
					requestIndex: 1,
					totalRequests: 2,
				}),
				executeAttempt({
					actionType: 'CONCURRENT',
					batchId,
					idempotencyKey: form.idempotencyKey,
					label: 'Parallel request B',
					payload: requestPayload,
					requestIndex: 2,
					totalRequests: 2,
				}),
			])

			finalizeConcurrentBatch(batchId)
		} finally {
			clearTimeout(pendingTimer)
		}
	}

	async function runSingleAction({
		actionType,
		label,
	}: {
		actionType: AttemptActionType
		label: string
	}) {
		const validationError = validateForm(form)
		if (validationError) {
			setErrorMessage(validationError)
			return
		}

		const startedIso = new Date().toISOString()
		const pendingTimer = schedulePendingFlow(
			'The backend is processing or replaying the persisted response for this idempotency key.',
		)

		setErrorMessage(null)
		setLiveFlow({
			title: label,
			description:
				actionType === 'REPLAY'
					? 'Replaying the same payload and idempotency key to inspect the persisted response.'
					: 'Sending a payment request to inspect the fresh processing path.',
			stage: 'REQUEST_CREATED',
			isLoading: true,
			idempotencyKey: form.idempotencyKey,
			actionType,
			startedAt: startedIso,
			updatedAt: startedIso,
			totalRequests: 1,
			completedRequests: 0,
		})

		try {
			await executeAttempt({
				actionType,
				batchId: crypto.randomUUID(),
				idempotencyKey: form.idempotencyKey,
				label,
				payload: requestPayload,
				requestIndex: null,
				totalRequests: 1,
			})
		} finally {
			clearTimeout(pendingTimer)
		}
	}

	function schedulePendingFlow(description: string) {
		return window.setTimeout(() => {
			setLiveFlow((current) => {
				if (!current.isLoading || current.stage !== 'REQUEST_CREATED') {
					return current
				}

				return {
					...current,
					stage: 'PENDING',
					description,
					updatedAt: new Date().toISOString(),
				}
			})
		}, LIVE_PENDING_DELAY_MS)
	}

	async function executeAttempt(params: ExecuteAttemptParams) {
		const context = createAttemptContext(params)

		try {
			const response = await sendPaymentRequest(apiUrl, context.idempotencyKey, context.payload)

			return await applyResponse(context, response)
		} catch (error) {
			const now = new Date().toISOString()
			const message = readErrorMessage(error)

			patchAttempt(context.attemptId, (attempt) => ({
				...attempt,
				httpStatus: 0,
				body: {
					message,
				},
				updatedAt: now,
				completedAt: now,
				elapsedMs: Math.round(performance.now() - context.startedAtMs),
				lifecycleStage: 'FAILED',
				outcome: 'FAILED',
				resultMode: context.priorTerminal ? 'REUSED' : 'FRESH',
				headline: 'Unable to reach backend',
				detail: message,
				isLoading: false,
			}))

			setErrorMessage(message)
			advanceLiveFlowCompletion('FAILED')
			finishSingleFlow('FAILED', message)

			return {
				outcome: 'FAILED' as const,
				status: 0,
			}
		} finally {
			decrementActiveKey(context.idempotencyKey)
		}
	}

	async function applyResponse(
		context: AttemptExecutionContext,
		response: PaymentResponse,
	): Promise<AttemptExecutionResult> {
		const now = new Date().toISOString()
		const elapsedMs = Math.round(performance.now() - context.startedAtMs)
		const outcome = getOutcomeFromResponse(response)

		if (outcome === 'PENDING') {
			context.sawPending = true

			patchAttempt(context.attemptId, (attempt) => ({
				...attempt,
				httpStatus: response.status,
				body: response.body,
				requestId: response.requestId,
				updatedAt: now,
				elapsedMs,
				lifecycleStage: 'PENDING',
				outcome: 'PENDING',
				resultMode: 'WAITING',
				headline: 'Request already in progress (PENDING)',
				detail:
					'A same-key request is already being processed. The UI is polling to fetch the stored final response.',
				scenarioIds: withScenario(attempt.scenarioIds, 'REQUEST_DURING_PROCESSING'),
				pollCount: 0,
				isLoading: true,
			}))
			updateScenario(
				'REQUEST_DURING_PROCESSING',
				'observed',
				'Request already in progress (PENDING). Polling for the final stored response.',
				now,
			)
			setLiveFlow((current) => ({
				...current,
				stage: 'PENDING',
				description:
					'Request already in progress (PENDING). Polling the same key until a persisted outcome is available.',
				updatedAt: now,
			}))

			return await pollForFinalResponse(context)
		}

		const resolution = describeFinalResolution(context, outcome, elapsedMs)

		patchAttempt(context.attemptId, (attempt) => ({
			...attempt,
			httpStatus: response.status,
			body: response.body,
			requestId: response.requestId,
			updatedAt: now,
			completedAt: now,
			elapsedMs,
			lifecycleStage: outcome === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
			outcome,
			resultMode: resolution.resultMode,
			headline: resolution.headline,
			detail: resolution.detail,
			pollCount: attempt.pollCount,
			isLoading: false,
		}))

		if (resolution.scenarioId === 'RETRY_AFTER_SUCCESS') {
			updateScenario(
				'RETRY_AFTER_SUCCESS',
				'observed',
				'Returning persisted SUCCESS (no reprocessing).',
				now,
			)
		}

		if (resolution.scenarioId === 'RETRY_AFTER_FAILURE') {
			updateScenario(
				'RETRY_AFTER_FAILURE',
				'observed',
				'Returning persisted FAILURE (no retry executed).',
				now,
			)
		}

		advanceLiveFlowCompletion(outcome)
		if (context.totalRequests === 1) {
			finishSingleFlow(outcome, resolution.flowDescription)
		}

		return {
			outcome,
			status: response.status,
		}
	}

	async function pollForFinalResponse(
		context: AttemptExecutionContext,
	): Promise<AttemptExecutionResult> {
		for (let pollCount = 1; pollCount <= CLIENT_POLL_MAX_ATTEMPTS; pollCount += 1) {
			await sleep(CLIENT_POLL_INTERVAL_MS)

			const response = await sendPaymentRequest(apiUrl, context.idempotencyKey, context.payload)
			const outcome = getOutcomeFromResponse(response)
			const now = new Date().toISOString()
			const elapsedMs = Math.round(performance.now() - context.startedAtMs)

			if (outcome === 'PENDING') {
				patchAttempt(context.attemptId, (attempt) => ({
					...attempt,
					httpStatus: response.status,
					body: response.body,
					requestId: response.requestId,
					updatedAt: now,
					elapsedMs,
					lifecycleStage: 'PENDING',
					outcome: 'PENDING',
					resultMode: 'WAITING',
					headline: 'Request already in progress (PENDING)',
					detail: `Still PENDING after poll ${pollCount}. Waiting for the persisted outcome.`,
					pollCount,
					isLoading: true,
				}))
				continue
			}

			return await applyResponse(context, response)
		}

		const now = new Date().toISOString()

		patchAttempt(context.attemptId, (attempt) => ({
			...attempt,
			updatedAt: now,
			completedAt: now,
			elapsedMs: Math.round(performance.now() - context.startedAtMs),
			lifecycleStage: 'PENDING',
			outcome: 'PENDING',
			resultMode: 'WAITING',
			headline: 'Still pending after short polling',
			detail:
				'Processing has not reached a terminal state yet. Replay the same key again to fetch the stored response once it finishes.',
			pollCount: CLIENT_POLL_MAX_ATTEMPTS,
			isLoading: false,
		}))
		advanceLiveFlowCompletion('PENDING')
		finishSingleFlow(
			'PENDING',
			'Still waiting on the final stored result. Replay the same key again to check after processing completes.',
		)

		return {
			outcome: 'PENDING' as const,
			status: 202,
		}
	}

	function createAttemptContext(params: ExecuteAttemptParams): AttemptExecutionContext {
		const startedIso = new Date().toISOString()
		const priorTerminal = findLatestTerminalAttempt(attemptsRef.current, params.idempotencyKey)
		const startedWhilePending = countActiveKey(params.idempotencyKey) > 0
		const scenarioIds = [
			...(params.actionType === 'CONCURRENT' ? (['CONCURRENT_REQUESTS'] as ScenarioId[]) : []),
			...(startedWhilePending ? (['REQUEST_DURING_PROCESSING'] as ScenarioId[]) : []),
			...(params.actionType === 'REPLAY' && priorTerminal?.outcome === 'SUCCESS'
				? (['RETRY_AFTER_SUCCESS'] as ScenarioId[])
				: []),
			...(params.actionType === 'REPLAY' && priorTerminal?.outcome === 'FAILED'
				? (['RETRY_AFTER_FAILURE'] as ScenarioId[])
				: []),
		]

		const attempt: AttemptRecord = {
			id: crypto.randomUUID(),
			batchId: params.batchId,
			label: params.label,
			actionType: params.actionType,
			requestIndex: params.requestIndex,
			requestPayload: params.payload,
			idempotencyKey: params.idempotencyKey,
			httpStatus: null,
			body: null,
			requestId: null,
			createdAt: startedIso,
			updatedAt: startedIso,
			completedAt: null,
			elapsedMs: null,
			lifecycleStage: 'REQUEST_CREATED',
			outcome: 'IDLE',
			resultMode: startedWhilePending ? 'WAITING' : priorTerminal ? 'REUSED' : 'FRESH',
			headline: startedWhilePending
				? 'Request created while the same key is still active'
				: params.actionType === 'REPLAY'
					? 'Replaying the same idempotency key'
					: params.actionType === 'CONCURRENT'
						? `Parallel request ${params.requestIndex}`
						: 'Fresh payment request created',
			detail: startedWhilePending
				? 'A request with this key was already in flight when this attempt started.'
				: 'Sending the request to the backend.',
			scenarioIds,
			isLoading: true,
			pollCount: 0,
		}

		pushAttempt(attempt)
		incrementActiveKey(params.idempotencyKey)

		if (startedWhilePending) {
			updateScenario(
				'REQUEST_DURING_PROCESSING',
				'active',
				'Request already in progress (PENDING). Waiting for the same key to settle.',
				startedIso,
			)
		}

		return {
			...params,
			attemptId: attempt.id,
			priorTerminal,
			startedAtMs: performance.now(),
			startedIso,
			startedWhilePending,
			sawPending: false,
		}
	}

	const finalizeConcurrentBatch = useEffectEvent((batchId: string) => {
		const batchAttempts = attemptsRef.current.filter((attempt) => attempt.batchId === batchId)
		const now = new Date().toISOString()

		if (batchAttempts.length === 0) {
			return
		}

		if (batchAttempts.some((attempt) => attempt.isLoading)) {
			return
		}

		if (batchAttempts.some((attempt) => attempt.outcome === 'PENDING')) {
			updateScenario(
				'CONCURRENT_REQUESTS',
				'observed',
				'Parallel requests were sent together, but at least one request is still waiting on a final persisted outcome.',
				now,
			)
			setLiveFlow((current) => ({
				...current,
				stage: 'PENDING',
				description:
					'Two parallel requests were sent. At least one is still waiting for the final stored response.',
				isLoading: false,
				updatedAt: now,
				completedRequests: current.totalRequests,
			}))

			return
		}

		if (batchAttempts.every((attempt) => isTerminalOutcome(attempt.outcome))) {
			const sharedOutcome = batchAttempts.every((attempt) =>
				haveSameFinalResult(attempt, batchAttempts[0] as AttemptRecord),
			)
			const outcome = batchAttempts[0]?.outcome === 'FAILED' ? 'FAILED' : 'SUCCESS'

			if (sharedOutcome) {
				updateAttempts((current) =>
					current.map((attempt) =>
						attempt.batchId === batchId && attempt.resultMode !== 'REUSED'
							? {
									...attempt,
									resultMode: 'SHARED',
									headline: 'Shared outcome returned',
									detail:
										'These parallel requests converged on the same persisted response. The backend processed the payment only once.',
								}
							: attempt,
					),
				)
				updateScenario(
					'CONCURRENT_REQUESTS',
					'observed',
					`2 parallel requests returned the same persisted ${outcome}. Only one request processed the payment.`,
					now,
				)
				setLiveFlow((current) => ({
					...current,
					stage: outcome,
					description: `2 parallel requests returned the same persisted ${outcome}. Only one request processed the payment.`,
					isLoading: false,
					updatedAt: now,
					completedRequests: current.totalRequests,
				}))
				concurrentBatchIdRef.current = null

				return
			}
		}

		updateScenario(
			'CONCURRENT_REQUESTS',
			'observed',
			'Parallel requests completed. Compare the grouped history to inspect the shared stored response.',
			now,
		)

		setLiveFlow((current) => ({
			...current,
			stage: batchAttempts[0]?.outcome === 'FAILED' ? 'FAILED' : 'SUCCESS',
			description:
				'Parallel requests completed. Compare the grouped history to inspect whether the backend replayed the stored outcome.',
			isLoading: false,
			updatedAt: now,
			completedRequests: current.totalRequests,
		}))
		concurrentBatchIdRef.current = null
	})

	function finishSingleFlow(outcome: PaymentOutcome, description: string) {
		setLiveFlow((current) => {
			if (current.totalRequests !== 1) {
				return current
			}

			return {
				...current,
				stage: outcome === 'IDLE' ? 'IDLE' : outcome,
				description,
				isLoading: false,
				updatedAt: new Date().toISOString(),
				completedRequests: 1,
			}
		})
	}

	function advanceLiveFlowCompletion(outcome: PaymentOutcome) {
		setLiveFlow((current) => {
			if (current.totalRequests <= 1) {
				return current
			}

			const nextCompleted = Math.min(current.totalRequests, current.completedRequests + 1)
			const nextStage =
				current.stage === 'FAILED' || outcome === 'FAILED'
					? 'FAILED'
					: outcome === 'PENDING'
						? 'PENDING'
						: current.stage === 'PENDING'
							? 'PENDING'
							: 'PENDING'

			return {
				...current,
				stage: nextStage,
				updatedAt: new Date().toISOString(),
				completedRequests: nextCompleted,
			}
		})
	}

	function setFormField<Key extends keyof PaymentFormState>(
		key: Key,
		value: PaymentFormState[Key],
	) {
		setForm((current) => ({
			...current,
			[key]: value,
		}))
	}

	function refreshIdempotencyKey() {
		setForm((current) => ({
			...current,
			idempotencyKey: createIdempotencyKey(),
		}))
	}

	function updateScenario(
		id: ScenarioId,
		status: ScenarioCardStatus,
		message: string,
		observedAt = new Date().toISOString(),
	) {
		setScenarioState((current) => ({
			...current,
			[id]: {
				...current[id],
				status,
				message,
				observedAt,
			},
		}))
	}

	function pushAttempt(attempt: AttemptRecord) {
		updateAttempts((current) => [attempt, ...current])
	}

	function patchAttempt(id: string, recipe: (attempt: AttemptRecord) => AttemptRecord) {
		updateAttempts((current) =>
			current.map((attempt) => (attempt.id === id ? recipe(attempt) : attempt)),
		)
	}

	function updateAttempts(recipe: (current: AttemptRecord[]) => AttemptRecord[]) {
		setAttempts((current) => {
			const next = recipe(current)
			attemptsRef.current = next
			return next
		})
	}

	function countActiveKey(idempotencyKey: string) {
		return activeKeyCountsRef.current.get(idempotencyKey) ?? 0
	}

	function incrementActiveKey(idempotencyKey: string) {
		activeKeyCountsRef.current.set(idempotencyKey, countActiveKey(idempotencyKey) + 1)
	}

	function decrementActiveKey(idempotencyKey: string) {
		const nextCount = Math.max(0, countActiveKey(idempotencyKey) - 1)

		if (nextCount === 0) {
			activeKeyCountsRef.current.delete(idempotencyKey)
			return
		}

		activeKeyCountsRef.current.set(idempotencyKey, nextCount)
	}

	return {
		attempts,
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
	}
}

function describeFinalResolution(
	context: AttemptExecutionContext,
	outcome: PaymentOutcome,
	elapsedMs: number,
): {
	detail: string
	flowDescription: string
	headline: string
	resultMode: AttemptResultMode
	scenarioId: ScenarioId | null
} {
	if (context.priorTerminal?.outcome === 'SUCCESS') {
		return {
			resultMode: 'REUSED',
			headline: 'Returning persisted SUCCESS',
			detail: 'Same key, same stored response. The backend did not reprocess the payment.',
			flowDescription: 'Returning persisted SUCCESS (no reprocessing).',
			scenarioId: 'RETRY_AFTER_SUCCESS',
		}
	}

	if (context.priorTerminal?.outcome === 'FAILED') {
		return {
			resultMode: 'REUSED',
			headline: 'Returning persisted FAILURE',
			detail: 'Same key, same stored failure. The backend did not execute a new retry.',
			flowDescription: 'Returning persisted FAILURE (no retry executed).',
			scenarioId: 'RETRY_AFTER_FAILURE',
		}
	}

	if (context.sawPending) {
		return {
			resultMode: 'REUSED',
			headline:
				outcome === 'SUCCESS'
					? 'Processing finished. Returning persisted SUCCESS'
					: 'Processing finished. Returning persisted FAILURE',
			detail:
				outcome === 'SUCCESS'
					? 'This request first observed PENDING and then received the stored SUCCESS response.'
					: 'This request first observed PENDING and then received the stored FAILURE response.',
			flowDescription:
				outcome === 'SUCCESS'
					? 'Request already in progress (PENDING) resolved to stored SUCCESS.'
					: 'Request already in progress (PENDING) resolved to stored FAILURE.',
			scenarioId: null,
		}
	}

	if (didLikelyReplayPersistedResponse(context, elapsedMs)) {
		if (outcome === 'SUCCESS') {
			return {
				resultMode: 'REUSED',
				headline: 'Returning persisted SUCCESS',
				detail: 'This same-key replay returned immediately with the stored SUCCESS response.',
				flowDescription: 'Returning persisted SUCCESS (no reprocessing).',
				scenarioId: 'RETRY_AFTER_SUCCESS',
			}
		}

		return {
			resultMode: 'REUSED',
			headline: 'Returning persisted FAILURE',
			detail: 'This same-key replay returned immediately with the stored FAILURE response.',
			flowDescription: 'Returning persisted FAILURE (no retry executed).',
			scenarioId: 'RETRY_AFTER_FAILURE',
		}
	}

	if (context.actionType === 'CONCURRENT') {
		return {
			resultMode: 'SHARED',
			headline: 'Parallel request completed',
			detail:
				'This response is part of the concurrency simulation. Compare both parallel requests to inspect the shared outcome.',
			flowDescription:
				'Parallel same-key requests completed. Compare the batch results to inspect the persisted outcome.',
			scenarioId: null,
		}
	}

	if (outcome === 'SUCCESS') {
		return {
			resultMode: 'FRESH',
			headline: 'Fresh SUCCESS persisted',
			detail:
				'The payment processed successfully and the terminal SUCCESS response is now stored for replay.',
			flowDescription:
				'The payment processed successfully and the response is now persisted for future same-key replays.',
			scenarioId: null,
		}
	}

	return {
		resultMode: 'FRESH',
		headline: 'Fresh FAILURE persisted',
		detail:
			'The processor failed once and the terminal FAILURE response is now stored for safe replay.',
		flowDescription:
			'The processor failed and the persisted FAILURE response will be reused on the next same-key replay.',
		scenarioId: null,
	}
}

function withScenario(current: ScenarioId[], next: ScenarioId) {
	return current.includes(next) ? current : [...current, next]
}

function didLikelyReplayPersistedResponse(context: AttemptExecutionContext, elapsedMs: number) {
	return (
		context.actionType === 'REPLAY' &&
		!context.startedWhilePending &&
		!context.priorTerminal &&
		elapsedMs <= PERSISTED_REPLAY_THRESHOLD_MS
	)
}

async function sendPaymentRequest(
	apiUrl: string,
	idempotencyKey: string,
	payload: PaymentRequestPayload,
) {
	const response = await fetch(`${apiUrl}/payments`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Idempotency-Key': idempotencyKey,
		},
		body: JSON.stringify(payload),
	})

	const body = (await response.json().catch(() => ({}))) as PaymentResponse['body']

	return {
		body,
		requestId: response.headers.get('X-Request-Id'),
		status: response.status,
	} satisfies PaymentResponse
}

async function sleep(ms: number) {
	await new Promise((resolve) => setTimeout(resolve, ms))
}

function readErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message
	}

	return 'Unexpected error while contacting the backend.'
}
