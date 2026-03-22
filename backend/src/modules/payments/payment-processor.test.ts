import { describe, expect, it, vi } from 'vitest'

import { PaymentProcessor, PaymentProcessorTemporaryError } from './payment-processor.js'

describe('PaymentProcessor', () => {
  it('returns a success response when the random failure check does not trigger', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    const processor = new PaymentProcessor({
      minDelayMs: 1500,
      maxDelayMs: 4000,
      failureRate: 0.3,
      randomFn: vi
        .fn()
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.9),
      sleepFn
    })

    const response = await processor.process(
      {
        amount: 100,
        customerId: 'customer-1'
      },
      'payment-1'
    )

    expect(sleepFn).toHaveBeenCalledOnce()
    expect(response).toEqual({
      paymentId: 'payment-1',
      status: 'SUCCESS',
      amount: 100,
      customerId: 'customer-1'
    })
  })

  it('throws a typed temporary processor error when the failure check triggers', async () => {
    const processor = new PaymentProcessor({
      minDelayMs: 1500,
      maxDelayMs: 4000,
      failureRate: 0.3,
      randomFn: vi
        .fn()
        .mockReturnValueOnce(0.2)
        .mockReturnValueOnce(0.1),
      sleepFn: vi.fn().mockResolvedValue(undefined)
    })

    await expect(
      processor.process(
        {
          amount: 100,
          customerId: 'customer-1'
        },
        'payment-2'
      )
    ).rejects.toBeInstanceOf(PaymentProcessorTemporaryError)
  })
})
