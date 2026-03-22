# Payment Idempotency Challenge Plan

## Summary

Build this project as a small monorepo with `backend/`, `frontend/`, `ARCHITECTURE.md`, and `README.md`, optimized for a 2-day take-home: strong correctness for idempotency and concurrency, simple delivery, and no extra infrastructure beyond what proves the solution.

The core rule is: PostgreSQL is the source of truth for idempotency and final response replay. Redis is optional infrastructure for UX and performance improvements only, never for payment correctness. The backend must persist `status`, `response_status_code`, and `response_body` so retries and concurrent calls can reuse the exact saved result.

## Language policy

- `PLAN.md` and `CODEX_PROMPTS.md` may be fully written in English.
- Only `ARCHITECTURE.md` and `README.md` must be written in Brazilian Portuguese (`pt-BR`).
- Source code, code identifiers, file names, dependency names, environment variables, HTTP headers, and AI-related instructions may remain in English.
- UI copy, code comments, operator-facing logs, and other human-facing text can also remain in English unless later constrained by implementation scope.

## Repository structure

- Create a root workspace with:
  - `backend/`: Node.js + TypeScript + Express
  - `frontend/`: React + Vite + Tailwind + shadcn/ui
  - `ARCHITECTURE.md`: technical architecture explanation in `pt-BR`
  - `README.md`: setup, usage, and tradeoffs in `pt-BR`
- Use `pnpm` as the default package manager.
- Keep this `PLAN.md` as the implementation reference.

## Backend

- Stack:
  - `express`
  - `pg`
  - `zod`
  - `pino` + `pino-http`
  - `dotenv`
  - `tsx`
  - `typescript`
  - `vitest` + `supertest`
  - `ioredis` only if the optional Redis integration is added later
- Suggested structure:
  - `src/app.ts`
  - `src/server.ts`
  - `src/config/`
  - `src/middlewares/`
  - `src/modules/payments/`
  - `src/shared/`
  - `src/migrations/`
- Expose `GET /health`.
- Expose `POST /payments` with:
  - body validation via `zod`
  - required `Idempotency-Key` header
  - request context middleware storing `requestId` and `idempotencyKey` in `res.locals`
  - centralized error handling middleware
- Use raw SQL with `pg`, not an ORM, to keep the concurrency rule explicit and easy to demonstrate.

## Database and idempotency rules

- Create `payment_status` enum with:
  - `PENDING`
  - `SUCCESS`
  - `FAILED`
- Create `payments` table with:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `idempotency_key TEXT NOT NULL UNIQUE`
  - `amount NUMERIC(12,2) NOT NULL CHECK (amount > 0)`
  - `customer_id TEXT NOT NULL`
  - `status payment_status NOT NULL`
  - `response_status_code INT`
  - `response_body JSONB`
  - `error_code TEXT`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Add indexes on `customer_id` and `status`.
- Implement repository methods:
  - `insertPendingPayment`
  - `findByIdempotencyKey`
  - `markSuccess`
  - `markFailed`
- `insertPendingPayment` must use `INSERT ... ON CONFLICT DO NOTHING RETURNING *`.

### Expected `POST /payments` flow

1. Validate body and header.
2. Try to insert a `PENDING` row.
3. If the insert succeeds, that request wins the race and owns processing.
4. If the insert does not succeed, fetch the existing row.
5. If the row is `SUCCESS` or `FAILED`, return the exact persisted `response_status_code` and `response_body`.
6. If the row is `PENDING`, poll Postgres for up to 3 seconds.
7. If it completes during polling, return the persisted final result.
8. If it is still `PENDING`, return `202` with a consistent pending body.

### Non-negotiable technical rules

- The main idempotency and concurrency guarantee must live in PostgreSQL.
- Redis cannot be the only source of deduplication.
- In-memory state cannot be part of correctness.
- Failure results must also be persisted and reused by retries.

## Response contract

- Persisted success:

```json
{
  "paymentId": "uuid",
  "status": "SUCCESS",
  "amount": 100,
  "customerId": "123"
}
```

- Persisted failure:

```json
{
  "paymentId": "uuid",
  "status": "FAILED",
  "reason": "PROCESSOR_TEMPORARY_ERROR"
}
```

- Still pending:

```json
{
  "paymentId": "uuid",
  "status": "PENDING"
}
```

## Simulated processor

- Create a `payment-processor` module with:
  - random delay between `1500ms` and `4000ms`
  - configurable failure probability, default `30%`
- Allow injection/config override so tests stay deterministic.
- On success, return the persisted success body.
- On failure, throw a typed error so the service can persist the failure body.

## Observability

- Configure `pino` and `pino-http`.
- Every log line should include:
  - `requestId`
  - `idempotencyKey` when present
- Middleware order:
  - request context
  - request logging
  - routes
  - error handler

## Frontend

- Stack:
  - React + Vite
  - Tailwind
  - shadcn/ui
- UI with:
  - `amount` field
  - `customerId` field
  - `idempotencyKey` field
  - create payment button
  - retry same request button
  - send 2 concurrent requests button
  - request payload panel
  - HTTP status panel
  - response body panel
  - attempts history
- Keep state management simple; no need for TanStack Query in v1.

## Environment

- Keep the environment simple for the challenge.
- Prioritize hosted services over local orchestration.
- Document deploy and environment setup in `README.md` and `ARCHITECTURE.md`.

## Redis

- Recommended v1 scope: optional and non-essential.
- Allowed uses:
  - short cache by `idempotencyKey`
  - lightweight completion signaling
  - future coordination improvements
- Disallowed as the correctness base:
  - primary payment lock
  - sole deduplication source

## Tests

### Unit

- `payment service`:
  - creates a new payment for a new key
  - reuses persisted success on retry
  - reuses persisted failure on retry
  - handles `PENDING` correctly
  - returns final result if the row completes within the polling window

### Integration

- `POST /payments`:
  - validates body and header
  - persists the first final response
  - returns the same response on retries with the same key
  - returns the same persisted failure after an initial failure
  - with 5 to 10 parallel requests using the same key, creates only one row
  - never executes duplicate processing for the same key

### Frontend coverage

- create payment flow
- retry same key flow
- simulated concurrency flow

## Implementation order

1. Minimal correct backend
2. Concurrency and idempotency tests
3. Frontend implementation
4. Final `ARCHITECTURE.md` and `README.md`

## Documentation

- `ARCHITECTURE.md` must include:
  - architecture overview
  - key technical decisions
  - why Postgres is the source of truth
  - how concurrency is handled
  - Neon and pooling notes
- `README.md` must include:
  - project overview
  - local setup
  - how to run tests
  - how to configure Neon
  - curl examples
  - tradeoffs and future work
- Both `ARCHITECTURE.md` and `README.md` must be written in `pt-BR`.

## Assumptions and defaults

- The repository is effectively empty, so this plan assumes a greenfield implementation.
- `pnpm` is the default package manager.
- Raw SQL with `pg` is the official persistence approach.
- Redis is optional and the correct solution must work with Redis disabled.
- Deployment uses Vercel for the frontend and Render for backend + Postgres.
- The main evaluation focus is backend correctness, concurrency proof, execution simplicity, and clarity of technical decisions.
