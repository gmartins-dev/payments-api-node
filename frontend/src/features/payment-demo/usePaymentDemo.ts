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
			label: 'Criar pagamento',
		})
	}

	async function handleReplaySameRequest() {
		await runSingleAction({
			actionType: 'REPLAY',
			label: 'Repetir mesma requisição (mesma chave)',
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
			'As duas requisições estão em andamento. Observe se ambas convergem para um resultado compartilhado ou para uma resposta PENDENTE persistida.',
		)

		setErrorMessage(null)
		setLiveFlow({
			title: 'Simular concorrência (2 requisições paralelas)',
			description: 'Disparando 2 requisições paralelas com a mesma chave de idempotência.',
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
			'Disparando 2 requisições paralelas com a mesma chave de idempotência.',
			startedIso,
		)

		try {
			await Promise.all([
				executeAttempt({
					actionType: 'CONCURRENT',
					batchId,
					idempotencyKey: form.idempotencyKey,
					label: 'Requisição paralela A',
					payload: requestPayload,
					requestIndex: 1,
					totalRequests: 2,
				}),
				executeAttempt({
					actionType: 'CONCURRENT',
					batchId,
					idempotencyKey: form.idempotencyKey,
					label: 'Requisição paralela B',
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
			'A API está processando ou reproduzindo a resposta persistida para esta chave de idempotência.',
		)

		setErrorMessage(null)
		setLiveFlow({
			title: label,
			description:
				actionType === 'REPLAY'
					? 'Repetindo o mesmo payload e a mesma chave de idempotência para inspecionar a resposta persistida.'
					: 'Enviando uma requisição de pagamento para inspecionar o caminho de processamento inicial.',
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
				headline: 'Falha ao acessar a API',
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
				headline: 'Requisição já em andamento (PENDING)',
				detail:
					'Uma requisição com a mesma chave já está sendo processada. A interface está fazendo consultas automáticas para buscar a resposta final persistida.',
				scenarioIds: withScenario(attempt.scenarioIds, 'REQUEST_DURING_PROCESSING'),
				pollCount: 0,
				isLoading: true,
			}))
			updateScenario(
				'REQUEST_DURING_PROCESSING',
				'observed',
				'Requisição já em andamento (PENDING). Fazendo consultas automáticas da resposta final persistida.',
				now,
			)
			setLiveFlow((current) => ({
				...current,
				stage: 'PENDING',
				description:
					'Requisição já em andamento (PENDING). Consultando a mesma chave até que um resultado persistido esteja disponível.',
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
				'Retornando SUCESSO persistido (sem reprocessamento).',
				now,
			)
		}

		if (resolution.scenarioId === 'RETRY_AFTER_FAILURE') {
			updateScenario(
				'RETRY_AFTER_FAILURE',
				'observed',
				'Retornando FALHA persistida (nenhuma nova tentativa executada).',
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
					headline: 'Requisição já em andamento (PENDING)',
					detail: `Ainda em PENDING após a consulta ${pollCount}. Aguardando o resultado persistido.`,
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
			headline: 'Ainda pendente após a consulta curta',
			detail:
				'O processamento ainda não chegou a um estado final. Repita a mesma chave novamente para buscar a resposta persistida quando ele terminar.',
			pollCount: CLIENT_POLL_MAX_ATTEMPTS,
			isLoading: false,
		}))
		advanceLiveFlowCompletion('PENDING')
		finishSingleFlow(
			'PENDING',
			'Ainda aguardando o resultado final persistido. Repita a mesma chave novamente para consultar após o fim do processamento.',
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
				? 'Requisição criada enquanto a mesma chave ainda está ativa'
				: params.actionType === 'REPLAY'
					? 'Repetindo a mesma chave de idempotência'
					: params.actionType === 'CONCURRENT'
						? `Requisição paralela ${params.requestIndex}`
						: 'Nova requisição de pagamento criada',
			detail: startedWhilePending
				? 'Já existia uma requisição com esta chave em andamento quando esta tentativa começou.'
				: 'Enviando a requisição para a API.',
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
				'Requisição já em andamento (PENDING). Aguardando a mesma chave concluir.',
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
				'As requisições paralelas foram enviadas juntas, mas pelo menos uma ainda aguarda um resultado final persistido.',
				now,
			)
			setLiveFlow((current) => ({
				...current,
				stage: 'PENDING',
				description:
					'Duas requisições paralelas foram enviadas. Pelo menos uma ainda aguarda a resposta final persistida.',
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
									headline: 'Resultado compartilhado retornado',
									detail:
										'Estas requisições paralelas convergiram para a mesma resposta persistida. A API processou o pagamento apenas uma vez.',
								}
							: attempt,
					),
				)
				updateScenario(
					'CONCURRENT_REQUESTS',
					'observed',
					`2 requisições paralelas retornaram o mesmo ${outcome === 'FAILED' ? 'resultado de FALHA persistido' : 'resultado de SUCESSO persistido'}. Apenas uma processou o pagamento.`,
					now,
				)
				setLiveFlow((current) => ({
					...current,
					stage: outcome,
					description: `2 requisições paralelas retornaram o mesmo ${outcome === 'FAILED' ? 'resultado de FALHA persistido' : 'resultado de SUCESSO persistido'}. Apenas uma processou o pagamento.`,
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
			'As requisições paralelas foram concluídas. Compare o histórico agrupado para inspecionar a resposta persistida compartilhada.',
			now,
		)

		setLiveFlow((current) => ({
			...current,
			stage: batchAttempts[0]?.outcome === 'FAILED' ? 'FAILED' : 'SUCCESS',
			description:
				'As requisições paralelas foram concluídas. Compare o histórico agrupado para verificar se a API reutilizou o resultado persistido.',
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
			headline: 'Retornando SUCESSO persistido',
			detail: 'Mesma chave, mesma resposta armazenada. A API não reprocessou o pagamento.',
			flowDescription: 'Retornando SUCESSO persistido (sem reprocessamento).',
			scenarioId: 'RETRY_AFTER_SUCCESS',
		}
	}

	if (context.priorTerminal?.outcome === 'FAILED') {
		return {
			resultMode: 'REUSED',
			headline: 'Retornando FALHA persistida',
			detail: 'Mesma chave, mesma falha armazenada. A API não executou uma nova tentativa.',
			flowDescription: 'Retornando FALHA persistida (nenhuma nova tentativa executada).',
			scenarioId: 'RETRY_AFTER_FAILURE',
		}
	}

	if (context.sawPending) {
		return {
			resultMode: 'REUSED',
			headline:
				outcome === 'SUCCESS'
					? 'Processamento concluído. Retornando SUCESSO persistido'
					: 'Processamento concluído. Retornando FALHA persistida',
			detail:
				outcome === 'SUCCESS'
					? 'Esta requisição primeiro observou PENDING e depois recebeu a resposta de SUCESSO armazenada.'
					: 'Esta requisição primeiro observou PENDING e depois recebeu a resposta de FALHA armazenada.',
			flowDescription:
				outcome === 'SUCCESS'
					? 'A requisição já em andamento (PENDING) foi resolvida com SUCESSO persistido.'
					: 'A requisição já em andamento (PENDING) foi resolvida com FALHA persistida.',
			scenarioId: null,
		}
	}

	if (didLikelyReplayPersistedResponse(context, elapsedMs)) {
		if (outcome === 'SUCCESS') {
			return {
				resultMode: 'REUSED',
				headline: 'Retornando SUCESSO persistido',
				detail:
					'Esta repetição com a mesma chave retornou imediatamente a resposta de SUCESSO armazenada.',
				flowDescription: 'Retornando SUCESSO persistido (sem reprocessamento).',
				scenarioId: 'RETRY_AFTER_SUCCESS',
			}
		}

		return {
			resultMode: 'REUSED',
			headline: 'Retornando FALHA persistida',
			detail:
				'Esta repetição com a mesma chave retornou imediatamente a resposta de FALHA armazenada.',
			flowDescription: 'Retornando FALHA persistida (nenhuma nova tentativa executada).',
			scenarioId: 'RETRY_AFTER_FAILURE',
		}
	}

	if (context.actionType === 'CONCURRENT') {
		return {
			resultMode: 'SHARED',
			headline: 'Requisição paralela concluída',
			detail:
				'Esta resposta faz parte da simulação de concorrência. Compare as duas requisições paralelas para inspecionar o resultado compartilhado.',
			flowDescription:
				'Requisições paralelas com a mesma chave foram concluídas. Compare os resultados do lote para inspecionar o resultado persistido.',
			scenarioId: null,
		}
	}

	if (outcome === 'SUCCESS') {
		return {
			resultMode: 'FRESH',
			headline: 'SUCESSO inicial persistido',
			detail:
				'O pagamento foi processado com sucesso e a resposta final de SUCESSO agora está armazenada para repetição segura.',
			flowDescription:
				'O pagamento foi processado com sucesso e a resposta agora está persistida para futuras repetições com a mesma chave.',
			scenarioId: null,
		}
	}

	return {
		resultMode: 'FRESH',
		headline: 'FALHA inicial persistida',
		detail:
			'O processador falhou uma vez e a resposta final de FALHA agora está armazenada para repetição segura.',
		flowDescription:
			'O processador falhou e a resposta persistida de FALHA será reutilizada na próxima repetição com a mesma chave.',
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
		if (error.message === 'Failed to fetch') {
			return 'Falha ao acessar a API.'
		}

		return error.message
	}

	return 'Erro inesperado ao contatar a API.'
}
