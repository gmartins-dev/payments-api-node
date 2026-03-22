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

export interface PaymentsScaffoldResponse {
  message: string
  idempotencyKey?: string
}

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export interface JsonObject {
  [key: string]: JsonValue
}
