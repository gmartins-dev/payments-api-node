import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Express, Request, Response } from 'express'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const currentDir = dirname(fileURLToPath(import.meta.url))

const apis = [
	resolve(currentDir, '../shared/http.ts'),
	resolve(currentDir, '../shared/http.js'),
	resolve(currentDir, '../modules/payments/payments.routes.ts'),
	resolve(currentDir, '../modules/payments/payments.routes.js'),
]

const swaggerOptions: swaggerJsdoc.Options = {
	definition: {
		openapi: '3.0.3',
		info: {
			title: 'Payment Idempotency API',
			version: '1.0.0',
			description:
				'API documentation for the payment idempotency challenge. PostgreSQL is the source of truth for idempotency and concurrent requests with the same Idempotency-Key never duplicate processing.',
		},
		servers: [
			{
				url: '/',
				description: 'Current server',
			},
		],
		tags: [
			{
				name: 'Health',
				description: 'Operational health endpoint',
			},
			{
				name: 'Payments',
				description: 'Idempotent payment creation and replay',
			},
		],
		components: {
			parameters: {
				IdempotencyKeyHeader: {
					name: 'Idempotency-Key',
					in: 'header',
					required: true,
					description:
						'Idempotency key used to guarantee that retries and concurrent requests reuse the same persisted outcome.',
					schema: {
						type: 'string',
					},
				},
			},
			schemas: {
				HealthResponse: {
					type: 'object',
					required: ['status'],
					properties: {
						status: {
							type: 'string',
							enum: ['ok'],
						},
					},
				},
				CreatePaymentRequest: {
					type: 'object',
					required: ['amount', 'customerId'],
					properties: {
						amount: {
							type: 'number',
							exclusiveMinimum: 0,
							example: 100,
						},
						customerId: {
							type: 'string',
							minLength: 1,
							example: 'customer-1',
						},
					},
				},
				PaymentSuccessResponse: {
					type: 'object',
					required: ['paymentId', 'status', 'amount', 'customerId'],
					properties: {
						paymentId: {
							type: 'string',
							format: 'uuid',
						},
						status: {
							type: 'string',
							enum: ['SUCCESS'],
						},
						amount: {
							type: 'number',
							example: 100,
						},
						customerId: {
							type: 'string',
							example: 'customer-1',
						},
					},
				},
				PaymentFailedResponse: {
					type: 'object',
					required: ['paymentId', 'status', 'reason'],
					properties: {
						paymentId: {
							type: 'string',
							format: 'uuid',
						},
						status: {
							type: 'string',
							enum: ['FAILED'],
						},
						reason: {
							type: 'string',
							example: 'PROCESSOR_TEMPORARY_ERROR',
						},
					},
				},
				PaymentPendingResponse: {
					type: 'object',
					required: ['paymentId', 'status'],
					properties: {
						paymentId: {
							type: 'string',
							format: 'uuid',
						},
						status: {
							type: 'string',
							enum: ['PENDING'],
						},
					},
				},
				ApiErrorResponse: {
					type: 'object',
					required: ['code', 'message', 'requestId'],
					properties: {
						code: {
							type: 'string',
							example: 'VALIDATION_ERROR',
						},
						message: {
							type: 'string',
							example: 'Invalid payment request body',
						},
						details: {
							nullable: true,
						},
						requestId: {
							type: 'string',
							example: 'a7f6fc52-fc41-4419-baf1-c9ca7efb3e10',
						},
					},
				},
			},
			examples: {
				PaymentSuccessExample: {
					summary: 'Fresh request succeeds',
					value: {
						paymentId: '7f26db40-a9d5-4a05-b571-f69819d5988f',
						status: 'SUCCESS',
						amount: 100,
						customerId: 'customer-1',
					},
				},
				PaymentFailedExample: {
					summary: 'Retry after a persisted failure',
					value: {
						paymentId: '7f26db40-a9d5-4a05-b571-f69819d5988f',
						status: 'FAILED',
						reason: 'PROCESSOR_TEMPORARY_ERROR',
					},
				},
				PaymentPendingExample: {
					summary: 'Request arrives while the original attempt is still processing',
					value: {
						paymentId: '7f26db40-a9d5-4a05-b571-f69819d5988f',
						status: 'PENDING',
					},
				},
			},
		},
	},
	apis,
}

export const openApiSpec = swaggerJsdoc(swaggerOptions)

export function registerSwagger(app: Express) {
	app.use('/docs', swaggerUi.serve)
	app.get(
		'/docs',
		swaggerUi.setup(openApiSpec, {
			explorer: true,
			customSiteTitle: 'Payment Idempotency API Docs',
		}),
	)
	app.get('/docs/openapi.json', (_req: Request, res: Response) => {
		res.status(200).json(openApiSpec)
	})
}
