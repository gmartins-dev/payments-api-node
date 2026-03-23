import { useMemo } from 'react'

import type { AttemptRecord, LiveFlowState } from '../model'
import { formatMetricTimestamp } from '../utils/presentation'

const defaultApiUrl = 'http://localhost:3000'

interface UsePaymentDemoViewModelParams {
	apiUrl: string
	groupedAttempts: Array<{ totalRequests: number }>
	latestAttempt: AttemptRecord | undefined
	liveFlow: LiveFlowState
}

export function usePaymentDemoViewModel({
	apiUrl,
	groupedAttempts,
	latestAttempt,
	liveFlow,
}: UsePaymentDemoViewModelParams) {
	return useMemo(() => {
		const requestCount = groupedAttempts.reduce((sum, group) => sum + group.totalRequests, 0)
		const latestOutcome = liveFlow.isLoading
			? liveFlow.stage === 'IDLE'
				? 'REQUEST_CREATED'
				: liveFlow.stage
			: (latestAttempt?.outcome ?? 'IDLE')
		const latestResponseTime = latestAttempt?.elapsedMs ?? null
		const lastUpdated = latestAttempt?.updatedAt ?? liveFlow.updatedAt

		return {
			apiDocsUrl: `${apiUrl}/docs`,
			apiTarget: apiUrl.replace(/^https?:\/\//, '') || defaultApiUrl.replace(/^https?:\/\//, ''),
			heroUpdatedAt: lastUpdated ? formatMetricTimestamp(lastUpdated) : 'Ainda sem eventos',
			lastUpdated,
			latestOutcome,
			latestResponseTime,
			requestCount,
		}
	}, [apiUrl, groupedAttempts, latestAttempt, liveFlow])
}
