export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface CreatePaymentInput {
  amount: number
  customerId: string
}

export interface PaymentResponse {
  message: string
  idempotencyKey?: string
}
