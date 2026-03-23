import { env } from '../../config/env.js'
import { AppError } from '../../shared/http-errors.js'
import { sleep } from '../../shared/sleep.js'
import type {
	CreatePaymentInput,
	PaymentProcessorConfig,
	PaymentSuccessResponse,
} from './payment.types.js'

const DEFAULT_MIN_DELAY_MS = 1500
const DEFAULT_MAX_DELAY_MS = 4000
const DEFAULT_FAILURE_RATE = env.PAYMENTS_FAILURE_RATE

export class PaymentProcessorTemporaryError extends AppError {
	constructor(paymentId: string) {
		super(503, 'PROCESSOR_TEMPORARY_ERROR', 'Processor temporary error', {
			paymentId,
			status: 'FAILED',
			reason: 'PROCESSOR_TEMPORARY_ERROR',
		})
	}
}

export class PaymentProcessor {
	constructor(private readonly config: PaymentProcessorConfig = {}) {}

	async process(input: CreatePaymentInput, paymentId: string): Promise<PaymentSuccessResponse> {
		// O processador simula latência real, mas a correção da idempotência continua 100% no banco.
		const delayMs = this.generateDelay()
		await (this.config.sleepFn ?? sleep)(delayMs)

		if (this.shouldFail()) {
			throw new PaymentProcessorTemporaryError(paymentId)
		}

		return {
			paymentId,
			status: 'SUCCESS',
			amount: input.amount,
			customerId: input.customerId,
		}
	}

	private generateDelay() {
		const minDelayMs = this.config.minDelayMs ?? DEFAULT_MIN_DELAY_MS
		const maxDelayMs = this.config.maxDelayMs ?? DEFAULT_MAX_DELAY_MS

		if (maxDelayMs < minDelayMs) {
			throw new AppError(500, 'INVALID_PROCESSOR_CONFIG', 'Processor delay range is invalid')
		}

		const random = this.random()
		const span = maxDelayMs - minDelayMs

		return minDelayMs + Math.round(span * random)
	}

	private shouldFail() {
		// A falha configurável existe para provar replay de erro sem depender de comportamento aleatório em teste.
		return this.random() < (this.config.failureRate ?? DEFAULT_FAILURE_RATE)
	}

	private random() {
		return (this.config.randomFn ?? Math.random)()
	}
}
