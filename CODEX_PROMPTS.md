# Codex Prompts by Sprint

## Purpose

This file organizes implementation prompts by sprint to build the project from zero to a presentable v1, with focus on:

- correct backend first
- early proof of idempotency and concurrency
- simple hosted setup
- lean frontend for demonstration
- strong final documentation

## Usage

- Run the prompts in the proposed order.
- Each sprint should produce a functional and verifiable increment.
- This file is intentionally written in English for AI prompt consistency.
- Only `ARCHITECTURE.md` and `README.md` must be written in Brazilian Portuguese (`pt-BR`).
- Code, comments, UI copy, logs, technical identifiers, dependency names, env vars, headers, and AI instructions may remain in English unless you explicitly decide otherwise during implementation.

## Sprint 0 — Foundation and repo setup

### Goal

Create the monorepo foundation, prepare the environment, and make the structure ready for backend and frontend implementation.

### Prompt

```text
You are a senior full-stack engineer. Set up a greenfield monorepo for a payment idempotency challenge.

Project goals:
- Backend: Node.js, TypeScript, Express, PostgreSQL
- Frontend: React, Vite, Tailwind CSS, shadcn/ui
- Optional infrastructure: Redis, but not as the source of truth for idempotency

Requirements:
- Create a clean monorepo structure with:
  - backend/
  - frontend/
  - ARCHITECTURE.md
  - README.md
- Use pnpm as the default package manager
- Add sensible .gitignore files
- Add .env.example files where needed
- Keep the structure simple, production-friendly, and easy to understand
- Write ARCHITECTURE.md and README.md in Brazilian Portuguese (pt-BR)
- Code, comments, UI copy, logs, identifiers, file names, env vars, HTTP headers, and AI-related instructions may remain in English

Deliverables:
- Root workspace setup
- Base package files
- Initial README skeleton
- Initial ARCHITECTURE skeleton
Output full files.
```

## Sprint 1 — Backend scaffold

### Goal

Set up the backend with modular structure, strict typing, health check, and the middleware/logging baseline.

### Prompt

```text
You are a senior backend engineer. Create the backend for a payment idempotency challenge using Node.js, TypeScript, Express, and PostgreSQL.

Requirements:
- Use TypeScript with strict mode
- Use Express
- Organize code by modules and layers:
  - config
  - middlewares
  - modules/payments
  - shared
- Add scripts for dev, build, start, test
- Use pino for logging and pino-http for request logging
- Use zod for request validation support
- Use pg for PostgreSQL access
- Add dotenv support
- Add tsx for local development
- Add a health endpoint GET /health
- Add robust error handling middleware
- Add request context middleware to capture requestId and Idempotency-Key
- Keep the implementation production-friendly and easy to understand
- Write ARCHITECTURE.md and README.md content in Brazilian Portuguese (pt-BR)
- Code, comments, logs, symbols, identifiers, env vars, header names, and technical integration details may stay in English

Project structure:
backend/
  src/
    app.ts
    server.ts
    config/
    middlewares/
    modules/payments/
    shared/

Also generate:
- package.json
- tsconfig.json
- .env.example
- ARCHITECTURE section for backend setup
- README section for backend setup

Output all files with full code.
```

## Sprint 2 — Database schema and repository layer

### Goal

Define the correct PostgreSQL model and implement the data access layer using the `UNIQUE(idempotency_key)` strategy.

### Prompt

```text
Implement the PostgreSQL schema and repository layer for a payment idempotency service.

Requirements:
- Create a PostgreSQL enum payment_status with values: PENDING, SUCCESS, FAILED
- Create a payments table with:
  - id UUID primary key
  - idempotency_key TEXT unique not null
  - amount numeric(12,2) not null check amount > 0
  - customer_id text not null
  - status payment_status not null
  - response_status_code int nullable
  - response_body jsonb nullable
  - error_code text nullable
  - created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- Provide SQL migration files
- Implement a repository using pg with these methods:
  - insertPendingPayment(input)
  - findByIdempotencyKey(key)
  - markSuccess(id, responseStatusCode, responseBody)
  - markFailed(id, responseStatusCode, responseBody, errorCode)
- insertPendingPayment must use INSERT ... ON CONFLICT DO NOTHING RETURNING *
- Keep types explicit and safe
- Write any architecture or README updates in Brazilian Portuguese (pt-BR)
- Code, comments, SQL notes, and identifiers may remain in English

Output full code for the migration and repository files.
```

## Sprint 3 — Idempotent payment flow

### Goal

Implement `POST /payments` with the main idempotency rule, persisted response replay, and consistent concurrency behavior.

### Prompt

```text
Implement the payment service logic for an idempotent POST /payments endpoint.

Business rules:
- The endpoint uses the Idempotency-Key header
- For the same Idempotency-Key:
  - only one request may actually process the payment
  - concurrent requests must not create duplicate processing
  - all retries must return the same persisted HTTP status and response body
  - if the first attempt fails, future retries must return the same failure result
- Do not use in-memory storage for idempotency
- PostgreSQL is the source of truth

Behavior:
- First request inserts a row with status PENDING
- If insert succeeds, this request owns processing
- If insert conflicts, load the existing record
- If existing record is SUCCESS or FAILED, return the exact persisted result
- If existing record is PENDING, poll the database for up to 3 seconds waiting for completion
- If still PENDING after timeout, return HTTP 202 with a pending body

Implementation requirements:
- Add payment service
- Add controller
- Add route POST /payments
- Validate body with zod:
  {
    amount: positive number,
    customerId: non-empty string
  }
- Validate Idempotency-Key header
- Return consistent response bodies
- Write any ARCHITECTURE.md and README.md updates in Brazilian Portuguese (pt-BR)
- Code, comments, responses, logs, enums, field names, identifiers, and protocol-level technical names may stay in English

Output full code.
```

## Sprint 4 — Simulated processor and failure model

### Goal

Add a simulated processor with variable timing and intermittent failure while keeping enough predictability for tests.

### Prompt

```text
Implement a simulated payment processor for the payment idempotency challenge.

Requirements:
- Create a payment processor module
- Simulate variable processing time with an async delay between 1500ms and 4000ms
- Simulate intermittent failure with a configurable probability (default 30%)
- On success, return a response body like:
  {
    paymentId: string,
    status: "SUCCESS",
    amount: number,
    customerId: string
  }
- On failure, throw a typed application error that the service can persist as:
  {
    paymentId: string,
    status: "FAILED",
    reason: "PROCESSOR_TEMPORARY_ERROR"
  }
- Keep the processor deterministic enough for testing by allowing dependency injection or configuration override
- Write any ARCHITECTURE.md and README.md updates in Brazilian Portuguese (pt-BR)
- Code, comments, and typed contracts may stay in English

Output full code.
```

## Sprint 5 — Observability and middleware hardening

### Goal

Improve logs, request context, and error handling to make the backend presentable and observable.

### Prompt

```text
Improve observability and request handling for the Express backend.

Requirements:
- Add pino logger configuration
- Add pino-http request logging middleware
- Every log line should include:
  - requestId
  - idempotencyKey when present
- Add a request context middleware that:
  - generates requestId if not provided
  - reads Idempotency-Key from headers
  - stores both values in res.locals
- Add centralized error handling middleware
- Ensure errors are logged with context
- Keep middleware order correct in Express
- Write any ARCHITECTURE.md and README.md updates in Brazilian Portuguese (pt-BR)
- Code, comments, log messages, symbols, identifiers, and protocol details may remain in English

Output full code changes only.
```

## Sprint 6 — Automated tests and concurrency proof

### Goal

Prove through automated tests that the solution does not duplicate processing and always returns the correct persisted result.

### Prompt

```text
Add automated tests for the payment idempotency backend using Vitest and Supertest.

Test requirements:
1. Creates a new payment successfully
2. Retries with the same Idempotency-Key return the same persisted success response
3. Retries with the same Idempotency-Key after failure return the same persisted failure response
4. Concurrent requests with the same Idempotency-Key do not create duplicate payment rows
5. A request arriving while processing is still pending returns either the final persisted result or HTTP 202 PENDING, but never creates duplicate processing

Implementation notes:
- Use a test database
- Make tests deterministic by mocking or injecting the payment processor behavior
- Verify database state in assertions
- Write any ARCHITECTURE.md and README.md updates in Brazilian Portuguese (pt-BR)
- Code, test descriptions, comments, helper text, helper names, and technical symbols may remain in English

Output full test files and any setup needed.
```

## Sprint 7 — Deployment configuration

### Goal

Prepare a minimal deployment setup for Vercel and Render without adding unnecessary infrastructure.

### Prompt

```text
Prepare deployment support for the payment idempotency project.

Requirements:
- Add deployment guidance for:
  - frontend on Vercel
  - backend on Render
  - PostgreSQL on Render
- Use environment variables for DB connection
- Add .env.example files
- Keep the setup lean and avoid unnecessary infrastructure
- Write ARCHITECTURE.md and README.md content in Brazilian Portuguese (pt-BR)
- Keep env var names, service names, and technical config keys in English

Output full files.
```

## Sprint 8 — Frontend demo

### Goal

Create a simple, polished interface that is enough to demonstrate the backend idempotency and concurrency behavior.

### Prompt

```text
Create a basic frontend for the payment idempotency challenge using React, Vite, Tailwind CSS, and shadcn/ui.

Requirements:
- Simple but polished UI
- Fields:
  - amount
  - customerId
  - idempotencyKey
- Buttons:
  - Create payment
  - Retry same request
  - Send 2 concurrent requests
- Display:
  - request payload
  - response status
  - response body
  - history of attempts
- Clearly demonstrate idempotent behavior for repeated requests with the same key
- Use functional React components with TypeScript
- Keep state management simple
- Use shadcn/ui components where it helps
- Write any ARCHITECTURE.md and README.md updates in Brazilian Portuguese (pt-BR)
- UI copy, comments, and component code may remain in English

Output full frontend code and setup files.
```

## Sprint 9 — Documentation and final polish

### Goal

Finish the delivery with strong technical documentation that clearly explains the main decisions and how to evaluate the solution.

### Prompt

```text
Write the final documentation for a payment idempotency challenge project.

The project uses:
- Backend: Node.js, TypeScript, Express, PostgreSQL
- Frontend: React, Vite, Tailwind, shadcn/ui
- Vercel for frontend hosting
- Render for backend and PostgreSQL hosting
- Neon can be used for cloud Postgres deployment

Required files:
- ARCHITECTURE.md
- README.md

ARCHITECTURE.md must include:
- Architecture overview
- Key design decisions
- Why PostgreSQL is the source of truth for idempotency
- How concurrency is handled
- Neon pooling guidance and why double pooling should be avoided

README.md must include:
- Project overview
- How to run locally
- How to configure Neon
- Example curl requests
- Test instructions
- Tradeoffs and future improvements

Language requirements:
- ARCHITECTURE.md must be written in Brazilian Portuguese (pt-BR)
- README.md must be written in Brazilian Portuguese (pt-BR)
- Technical identifiers, code snippets, env vars, commands, and protocol names may remain in English

Make both documents concise, professional, and technically strong.
```

## Extra prompt — Final review pass

### Goal

Run a final review focused on technical consistency, delivery quality, and alignment with the challenge.

### Prompt

```text
Review the entire payment idempotency project as a senior engineer before delivery.

Review goals:
- Check whether PostgreSQL is truly the source of truth for idempotency
- Confirm that no in-memory logic is required for correctness
- Confirm that Redis is optional and not used as the primary locking/idempotency mechanism
- Verify that retries return the same persisted HTTP status and response body
- Verify that concurrent requests with the same Idempotency-Key do not duplicate processing
- Review deployment setup clarity
- Review ARCHITECTURE.md clarity
- Review README.md clarity
- Review that ARCHITECTURE.md and README.md are written in Brazilian Portuguese (pt-BR)

Output:
- findings first, ordered by severity
- missing tests or risks
- small final improvement suggestions
```

## Final checklist

### Architecture and correctness

- [ ] PostgreSQL is the source of truth for idempotency
- [ ] `UNIQUE(idempotency_key)` exists on `payments`
- [ ] The flow uses `INSERT ... ON CONFLICT DO NOTHING RETURNING *`
- [ ] Only the request that inserted the row processes the payment
- [ ] Retries return the exact persisted `response_status_code` and `response_body`
- [ ] Failure results are also persisted and reused
- [ ] `PENDING` is handled with short polling and a consistent response
- [ ] Redis is not used as the primary correctness mechanism

### Backend

- [ ] `GET /health` implemented
- [ ] `POST /payments` implemented
- [ ] Body validation with `zod`
- [ ] `Idempotency-Key` header validation
- [ ] Request context middleware implemented
- [ ] Centralized error handler implemented
- [ ] Logs include `requestId` and `idempotencyKey`

### Database and persistence

- [ ] SQL migrations created
- [ ] `payment_status` enum created
- [ ] `payments` table created with all required fields
- [ ] Additional indexes created
- [ ] Repository exposes `insertPendingPayment`, `findByIdempotencyKey`, `markSuccess`, and `markFailed`

### Tests

- [ ] Initial success test implemented
- [ ] Retry with same persisted success result implemented
- [ ] Retry after failure implemented
- [ ] Concurrency test with multiple parallel requests implemented
- [ ] `PENDING` behavior test implemented
- [ ] Tests are deterministic via injection or mocking

### Frontend

- [ ] Form with `amount`, `customerId`, and `idempotencyKey`
- [ ] Create payment action
- [ ] Retry same request action
- [ ] Simulated concurrency action
- [ ] Payload, status, response, and history displayed

### Environment

- [ ] Frontend deployment path on Vercel is documented
- [ ] Backend deployment path on Render is documented
- [ ] PostgreSQL setup on Render is documented
- [ ] `.env.example` files available
- [ ] `README.md` explains local execution and Neon configuration
- [ ] `ARCHITECTURE.md` and `README.md` document Neon pooling and double pooling concerns

### Delivery quality

- [ ] `ARCHITECTURE.md` is clear, technical, and objective in `pt-BR`
- [ ] `README.md` is clear, practical, and objective in `pt-BR`
- [ ] The project can be evaluated without extra verbal explanation
- [ ] The scope is strong without overengineering
- [ ] The main value demonstration is correctness under idempotency and concurrency
