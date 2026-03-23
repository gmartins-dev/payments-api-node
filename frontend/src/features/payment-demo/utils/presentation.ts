import type { AttemptActionType, AttemptRecord, LiveFlowStage, ScenarioCardState } from '../model'

export function formatStageLabel(value: string) {
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

export function formatActionTypeLabel(value: AttemptActionType) {
	return {
		CONCURRENT: 'CONCORRÊNCIA',
		CREATE: 'CRIAÇÃO',
		REPLAY: 'REPETIÇÃO',
	}[value]
}

export function formatResultModeLabel(attempt: AttemptRecord) {
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

export function formatMetricTimestamp(value: string) {
	return new Intl.DateTimeFormat('pt-BR', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(value))
}

export function formatAmountPreview(value: string) {
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

export function getNextSuggestion(attempt: AttemptRecord) {
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

export function getScenarioNumber(title: ScenarioCardState['title']) {
	const match = title.match(/Cenário\s+(\d+)/i)

	return match?.[1] ?? '•'
}

export function getScenarioTitle(title: ScenarioCardState['title']) {
	const parts = title.split('—')

	return parts.length > 1 ? parts.slice(1).join('—').trim() : title
}

export function isStepComplete(currentStage: LiveFlowStage, step: Exclude<LiveFlowStage, 'IDLE'>) {
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
