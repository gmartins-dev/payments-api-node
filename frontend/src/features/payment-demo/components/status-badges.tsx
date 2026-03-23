import { Badge } from '../../../components/ui/badge'
import type { AttemptActionType, AttemptRecord, LiveFlowStage, PaymentOutcome } from '../model'
import { formatActionTypeLabel } from '../utils/presentation'

export function ActionBadge({ actionType }: { actionType: AttemptActionType }) {
	return <Badge variant="neutral">{formatActionTypeLabel(actionType)}</Badge>
}

export function OutcomeBadge({ outcome }: { outcome: PaymentOutcome }) {
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

export function ResultModeBadge({ attempt }: { attempt: AttemptRecord }) {
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

export function StageBadge({ stage }: { stage: LiveFlowStage }) {
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

export function ScenarioStatusBadge({ status }: { status: 'active' | 'idle' | 'observed' }) {
	if (status === 'observed') {
		return <Badge variant="info">Observado</Badge>
	}

	if (status === 'active') {
		return <Badge variant="pending">Em teste</Badge>
	}

	return <Badge variant="neutral">Pronto para testar</Badge>
}
