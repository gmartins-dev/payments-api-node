import 'dotenv/config'

import { z } from 'zod'

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.coerce.number().int().positive().default(3000),
	FRONTEND_URL: z.string().url().default('http://localhost:5173'),
	DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/payments'),
	PAYMENTS_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.3),
	REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
})

export const env = envSchema.parse(process.env)
