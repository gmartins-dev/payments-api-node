import { z } from 'zod'

export const createPaymentBodySchema = z.object({
  amount: z.number().positive(),
  customerId: z.string().trim().min(1)
})

export const idempotencyKeyHeaderSchema = z.object({
  'idempotency-key': z.string().trim().min(1)
})

export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>
