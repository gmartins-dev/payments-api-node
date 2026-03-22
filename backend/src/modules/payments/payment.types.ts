export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface CreatePaymentInput {
  amount: number
  customerId: string
}

export interface PaymentRow {
  id: string
  idempotencyKey: string
  amount: number
  customerId: string
  status: PaymentStatus
  responseStatusCode: number | null
  responseBody: JsonValue | null
  errorCode: string | null
  createdAt: string
  updatedAt: string
}

export interface InsertPendingPaymentInput extends CreatePaymentInput {
  idempotencyKey: string
}

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export interface JsonObject {
  [key: string]: JsonValue
}

export interface PaymentSuccessResponse extends JsonObject {
  paymentId: string
  status: 'SUCCESS'
  amount: number
  customerId: string
}

export interface PaymentFailedResponse extends JsonObject {
  paymentId: string
  status: 'FAILED'
  reason: string
}

export interface PaymentPendingResponse extends JsonObject {
  paymentId: string
  status: 'PENDING'
}

export type PersistedPaymentResponse = PaymentSuccessResponse | PaymentFailedResponse
export type PaymentApiResponse = PersistedPaymentResponse | PaymentPendingResponse
