import type { CreatePaymentInput, PaymentResponse } from './payment.types.js'

export class PaymentProcessor {
  async process(_input: CreatePaymentInput, idempotencyKey: string): Promise<PaymentResponse> {
    return {
      message: 'Payments flow not implemented yet',
      idempotencyKey
    }
  }
}
