import type { CreatePaymentInput, PaymentSuccessResponse } from './payment.types.js'

export class PaymentProcessor {
  async process(input: CreatePaymentInput, paymentId: string): Promise<PaymentSuccessResponse> {
    return {
      paymentId,
      status: 'SUCCESS',
      amount: input.amount,
      customerId: input.customerId
    }
  }
}
