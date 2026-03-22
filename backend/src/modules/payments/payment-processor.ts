import type { CreatePaymentInput, PaymentsScaffoldResponse } from './payment.types.js'

export class PaymentProcessor {
  async process(_input: CreatePaymentInput, idempotencyKey: string): Promise<PaymentsScaffoldResponse> {
    return {
      message: 'Payments flow not implemented yet',
      idempotencyKey
    }
  }
}
