import { describe, expect, it } from 'vitest'

import { openApiSpec } from './swagger.js'

describe('openApiSpec', () => {
	it('documents the expected API surface', () => {
		const spec = openApiSpec as {
			openapi?: string
			paths?: Record<string, { get?: unknown; post?: unknown }>
			components?: {
				parameters?: Record<string, unknown>
				schemas?: Record<string, unknown>
			}
		}

		expect(spec.openapi).toBe('3.0.3')
		expect(spec.paths?.['/health']?.get).toBeDefined()
		expect(spec.paths?.['/payments']?.post).toBeDefined()
		expect(spec.components?.parameters?.IdempotencyKeyHeader).toBeDefined()
		expect(spec.components?.schemas?.PaymentSuccessResponse).toBeDefined()
		expect(spec.components?.schemas?.PaymentFailedResponse).toBeDefined()
		expect(spec.components?.schemas?.PaymentPendingResponse).toBeDefined()
	})
})
