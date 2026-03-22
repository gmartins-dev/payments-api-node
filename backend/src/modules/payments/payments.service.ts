import { ConflictError, NotFoundError } from '../../shared/http-errors.js'
import { sleep } from '../../shared/sleep.js'
import type {
	CreatePaymentInput,
	PaymentApiResponse,
	PaymentPendingResponse,
	PaymentRow,
	PersistedPaymentResponse,
} from './payment.types.js'
import { PaymentProcessor, PaymentProcessorTemporaryError } from './payment-processor.js'
import { PaymentsRepository } from './payments.repository.js'

const DEFAULT_POLL_INTERVAL_MS = 100
const DEFAULT_POLL_TIMEOUT_MS = 3000

interface PaymentsServiceOptions {
	pollIntervalMs?: number
	pollTimeoutMs?: number
	sleepFn?: (delayMs: number) => Promise<void>
}

export class PaymentsService {
	constructor(
		private readonly repository = new PaymentsRepository(),
		private readonly processor = new PaymentProcessor(),
		private readonly options: PaymentsServiceOptions = {},
	) {}

	async createPayment(
		input: CreatePaymentInput,
		idempotencyKey: string,
	): Promise<{ statusCode: number; body: PaymentApiResponse }> {
		// A fonte de verdade é o Postgres: quem inserir primeiro vence a ownership.
		const inserted = await this.repository.insertPendingPayment({
			...input,
			idempotencyKey,
		})

		if (inserted) {
			return this.processOwnedPayment(inserted, input)
		}

		const existing = await this.repository.findByIdempotencyKey(idempotencyKey)
		if (!existing) {
			throw new NotFoundError('Existing payment record was not found after idempotency conflict')
		}

		this.assertSamePayload(existing, input)

		// Retries nunca recalculam o resultado: reaproveitam exatamente o que foi persistido.
		if (existing.status === 'SUCCESS' || existing.status === 'FAILED') {
			return replayPersistedResponse(existing)
		}

		// Polling curto evita estado em memória e dá chance de devolver o resultado final sem lock distribuído.
		const completed = await this.waitForCompletion(idempotencyKey, input)
		if (completed) {
			return replayPersistedResponse(completed)
		}

		return {
			// 202 deixa explícito que já existe uma request dona do processamento, mas ainda sem estado final persistido.
			statusCode: 202,
			body: {
				paymentId: existing.id,
				status: 'PENDING',
			} satisfies PaymentPendingResponse,
		}
	}

	private async processOwnedPayment(payment: PaymentRow, input: CreatePaymentInput) {
		try {
			const processed = await this.processor.process(input, payment.id)
			// A resposta final é persistida antes do retorno para que todo retry reaproveite o mesmo contrato.
			const saved = await this.repository.markSuccess(payment.id, 200, processed)

			return replayPersistedResponse(saved)
		} catch (error) {
			const failedResponse = {
				paymentId: payment.id,
				status: 'FAILED' as const,
				reason: extractFailureReason(error),
			}

			// Falhas persistidas continuam idempotentes, mas usam status final de erro para deixar o contrato mais natural.
			const saved = await this.repository.markFailed(
				payment.id,
				503,
				failedResponse,
				failedResponse.reason,
			)

			return replayPersistedResponse(saved)
		}
	}

	private async waitForCompletion(idempotencyKey: string, input: CreatePaymentInput) {
		const deadline = Date.now() + (this.options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS)

		while (Date.now() < deadline) {
			// Limites explícitos evitam espera indefinida e deixam o comportamento previsível para cliente e testes.
			await (this.options.sleepFn ?? sleep)(this.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)

			const payment = await this.repository.findByIdempotencyKey(idempotencyKey)
			if (!payment) {
				throw new NotFoundError('Payment record disappeared during polling')
			}

			this.assertSamePayload(payment, input)

			if (payment.status === 'SUCCESS' || payment.status === 'FAILED') {
				return payment
			}
		}

		return null
	}

	private assertSamePayload(payment: PaymentRow, input: CreatePaymentInput) {
		// Reusar a mesma chave com payload diferente quebra a semântica de idempotência e precisa falhar.
		if (payment.amount !== input.amount || payment.customerId !== input.customerId) {
			throw new ConflictError('Idempotency-Key cannot be reused with a different payload')
		}
	}
}

function replayPersistedResponse(payment: PaymentRow): {
	statusCode: number
	body: PersistedPaymentResponse
} {
	if (payment.status !== 'SUCCESS' && payment.status !== 'FAILED') {
		throw new NotFoundError('Cannot replay a payment response that is not finalized')
	}

	// O replay só é seguro porque status HTTP e body final foram persistidos juntos.
	if (
		payment.responseStatusCode === null ||
		payment.responseBody === null ||
		!isPersistedPaymentResponse(payment.responseBody)
	) {
		throw new NotFoundError('Persisted payment response is incomplete')
	}

	return {
		statusCode: payment.responseStatusCode,
		body: payment.responseBody,
	}
}

function isPersistedPaymentResponse(value: unknown): value is PersistedPaymentResponse {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false
	}

	const candidate = value as Record<string, unknown>

	if (candidate.status === 'SUCCESS') {
		return (
			typeof candidate.paymentId === 'string' &&
			typeof candidate.amount === 'number' &&
			typeof candidate.customerId === 'string'
		)
	}

	if (candidate.status === 'FAILED') {
		return typeof candidate.paymentId === 'string' && typeof candidate.reason === 'string'
	}

	return false
}

function extractFailureReason(error: unknown) {
	if (error instanceof PaymentProcessorTemporaryError) {
		return error.code
	}

	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message
	}

	return 'PROCESSOR_ERROR'
}
