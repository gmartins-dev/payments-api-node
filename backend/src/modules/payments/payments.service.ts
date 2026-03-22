import { PaymentProcessor } from './payment-processor.js'
import { PaymentsRepository } from './payments.repository.js'
import type { CreatePaymentInput, PaymentResponse } from './payment.types.js'

export class PaymentsService {
  constructor(
    private readonly repository = new PaymentsRepository(),
    private readonly processor = new PaymentProcessor()
  ) {}

  async createPayment(input: CreatePaymentInput, idempotencyKey: string): Promise<PaymentResponse> {
    await this.repository.isReady()

    return this.processor.process(input, idempotencyKey)
  }
}
