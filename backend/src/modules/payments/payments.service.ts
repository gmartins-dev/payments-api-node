import { PaymentProcessor } from './payment-processor.js'
import { PaymentsRepository } from './payments.repository.js'
import type { CreatePaymentInput, PaymentsScaffoldResponse } from './payment.types.js'

export class PaymentsService {
  constructor(
    private readonly repository = new PaymentsRepository(),
    private readonly processor = new PaymentProcessor()
  ) {}

  async createPayment(input: CreatePaymentInput, idempotencyKey: string): Promise<PaymentsScaffoldResponse> {
    return this.processor.process(input, idempotencyKey)
  }
}
