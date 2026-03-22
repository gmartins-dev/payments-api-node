import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'

interface PaymentFormState {
	amount: string
	customerId: string
	idempotencyKey: string
}

interface AttemptRecord {
	id: string
	label: string
	requestPayload: {
		amount: number
		customerId: string
	}
	idempotencyKey: string
	status: number
	body: unknown
	requestId: string | null
	createdAt: string
}

const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const initialFormState: PaymentFormState = {
	amount: '100',
	customerId: 'customer-1',
	idempotencyKey: createIdempotencyKey(),
}

export function App() {
	const [form, setForm] = useState<PaymentFormState>(initialFormState)
	const [attempts, setAttempts] = useState<AttemptRecord[]>([])
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	const requestPayload = useMemo(() => {
		const parsedAmount = Number(form.amount)

		return {
			amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
			customerId: form.customerId,
		}
	}, [form.amount, form.customerId])

	const latestAttempt = attempts[0] ?? null

	async function handleCreatePayment() {
		await runSingleAttempt('Create payment', form.idempotencyKey, requestPayload)
	}

	async function handleRetrySameRequest() {
		await runSingleAttempt('Retry same request', form.idempotencyKey, requestPayload)
	}

	async function handleConcurrentRequests() {
		const validationError = validateForm(form)
		if (validationError) {
			setErrorMessage(validationError)
			return
		}

		setErrorMessage(null)
		setIsSubmitting(true)

		try {
			const [first, second] = await Promise.all([
				sendPaymentRequest(form.idempotencyKey, requestPayload),
				sendPaymentRequest(form.idempotencyKey, requestPayload),
			])

			const createdAt = new Date().toISOString()
			setAttempts((current) => [
				toAttemptRecord(
					'Concurrent request #2',
					form.idempotencyKey,
					requestPayload,
					second,
					createdAt,
				),
				toAttemptRecord(
					'Concurrent request #1',
					form.idempotencyKey,
					requestPayload,
					first,
					createdAt,
				),
				...current,
			])
		} catch (error) {
			setErrorMessage(readErrorMessage(error))
		} finally {
			setIsSubmitting(false)
		}
	}

	async function runSingleAttempt(
		label: string,
		idempotencyKey: string,
		payload: { amount: number; customerId: string },
	) {
		const validationError = validateForm(form)
		if (validationError) {
			setErrorMessage(validationError)
			return
		}

		setErrorMessage(null)
		setIsSubmitting(true)

		try {
			const response = await sendPaymentRequest(idempotencyKey, payload)
			setAttempts((current) => [
				toAttemptRecord(label, idempotencyKey, payload, response, new Date().toISOString()),
				...current,
			])
		} catch (error) {
			setErrorMessage(readErrorMessage(error))
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.15),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.15),_transparent_34%),var(--color-page)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
			<div className="mx-auto flex max-w-7xl flex-col gap-6">
				<section className="reveal rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(15,23,42,0.64))] p-8 shadow-[0_30px_120px_rgba(2,6,23,0.45)] backdrop-blur-xl">
					<div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
						<div className="max-w-3xl space-y-4">
							<p className="text-xs font-semibold uppercase tracking-[0.38em] text-[var(--color-accent)]">
								Payment Idempotency Demo
							</p>
							<h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
								One key, one persisted outcome, no duplicate processing.
							</h1>
							<p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
								This frontend drives the backend through fresh requests, same-key retries, and
								concurrent submissions so the idempotency behavior is visible instead of assumed.
							</p>
						</div>

						<div className="grid gap-3 sm:grid-cols-3">
							<Metric label="Backend target" value={apiUrl.replace(/^https?:\/\//, '')} />
							<Metric
								label="Latest status"
								value={latestAttempt ? String(latestAttempt.status) : 'Idle'}
							/>
							<Metric label="Attempts" value={String(attempts.length)} />
						</div>
					</div>
				</section>

				<section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
					<Card className="reveal">
						<CardHeader>
							<CardTitle>Payment playground</CardTitle>
							<CardDescription>
								Use the same idempotency key to replay the stored result or trigger two parallel
								requests.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid gap-4 md:grid-cols-3">
								<Field htmlFor="payment-amount" label="Amount">
									<Input
										id="payment-amount"
										inputMode="decimal"
										onChange={(event) =>
											setForm((current) => ({ ...current, amount: event.target.value }))
										}
										placeholder="100"
										value={form.amount}
									/>
								</Field>
								<Field htmlFor="payment-customer-id" label="Customer ID">
									<Input
										id="payment-customer-id"
										onChange={(event) =>
											setForm((current) => ({ ...current, customerId: event.target.value }))
										}
										placeholder="customer-1"
										value={form.customerId}
									/>
								</Field>
								<Field htmlFor="payment-idempotency-key" label="Idempotency key">
									<div className="flex gap-2">
										<Input
											className="flex-1"
											id="payment-idempotency-key"
											onChange={(event) =>
												setForm((current) => ({ ...current, idempotencyKey: event.target.value }))
											}
											placeholder="payment-demo-001"
											value={form.idempotencyKey}
										/>
										<Button
											className="shrink-0"
											onClick={() =>
												setForm((current) => ({
													...current,
													idempotencyKey: createIdempotencyKey(),
												}))
											}
											size="sm"
											variant="outline"
										>
											New key
										</Button>
									</div>
								</Field>
							</div>

							<div className="flex flex-col gap-3 md:flex-row">
								<Button className="md:flex-1" disabled={isSubmitting} onClick={handleCreatePayment}>
									Create payment
								</Button>
								<Button
									className="md:flex-1"
									disabled={isSubmitting}
									onClick={handleRetrySameRequest}
									variant="outline"
								>
									Retry same request
								</Button>
								<Button
									className="md:flex-1"
									disabled={isSubmitting}
									onClick={handleConcurrentRequests}
									variant="secondary"
								>
									Send 2 concurrent requests
								</Button>
							</div>

							{errorMessage ? (
								<div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
									{errorMessage}
								</div>
							) : null}

							<div className="grid gap-4 lg:grid-cols-2">
								<JsonPanel
									caption="Current request payload"
									title="Request payload"
									value={{
										amount: requestPayload.amount,
										customerId: requestPayload.customerId,
										idempotencyKey: form.idempotencyKey,
									}}
								/>
								<JsonPanel
									caption={
										latestAttempt
											? `HTTP ${latestAttempt.status}${latestAttempt.requestId ? ` • ${latestAttempt.requestId}` : ''}`
											: 'No response yet'
									}
									title="Latest response body"
									value={latestAttempt?.body ?? { status: 'IDLE' }}
								/>
							</div>
						</CardContent>
					</Card>

					<Card className="reveal">
						<CardHeader>
							<CardTitle>Attempt history</CardTitle>
							<CardDescription>
								Each entry records the request payload, HTTP status, and persisted response body
								returned by the API.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{attempts.length === 0 ? (
								<div className="rounded-[24px] border border-dashed border-white/12 bg-slate-950/50 p-6 text-sm leading-6 text-slate-400">
									No attempts yet. Start with a fresh key, then hit retry or concurrency to observe
									how the same stored result is reused.
								</div>
							) : (
								<div className="space-y-4">
									{attempts.map((attempt) => (
										<article
											className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_18px_40px_rgba(2,6,23,0.3)]"
											key={attempt.id}
										>
											<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
												<div>
													<p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
														{attempt.label}
													</p>
													<p className="mt-2 text-sm text-slate-400">
														{formatTimestamp(attempt.createdAt)}
													</p>
												</div>
												<StatusBadge status={attempt.status} />
											</div>

											<dl className="mt-4 grid gap-3 text-sm text-slate-300">
												<div>
													<dt className="text-xs uppercase tracking-[0.22em] text-slate-500">
														Idempotency key
													</dt>
													<dd className="mt-1 break-all font-medium text-slate-100">
														{attempt.idempotencyKey}
													</dd>
												</div>
												<div>
													<dt className="text-xs uppercase tracking-[0.22em] text-slate-500">
														Request payload
													</dt>
													<dd className="mt-2 overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-6 text-slate-200">
														<pre>{formatJson(attempt.requestPayload)}</pre>
													</dd>
												</div>
												<div>
													<dt className="text-xs uppercase tracking-[0.22em] text-slate-500">
														Response body
													</dt>
													<dd className="mt-2 overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs leading-6 text-slate-200">
														<pre>{formatJson(attempt.body)}</pre>
													</dd>
												</div>
											</dl>
										</article>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</section>
			</div>
		</main>
	)
}

function Field({
	children,
	htmlFor,
	label,
}: {
	children: ReactNode
	htmlFor: string
	label: string
}) {
	return (
		<div className="space-y-2">
			<label
				className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400"
				htmlFor={htmlFor}
			>
				{label}
			</label>
			{children}
		</div>
	)
}

function JsonPanel({ caption, title, value }: { caption: string; title: string; value: unknown }) {
	return (
		<div className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5">
			<p className="text-xs uppercase tracking-[0.24em] text-slate-500">{caption}</p>
			<h3 className="mt-3 font-display text-xl text-slate-50">{title}</h3>
			<div className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
				<pre>{formatJson(value)}</pre>
			</div>
		</div>
	)
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4">
			<p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
			<p className="mt-3 font-display text-lg text-white">{value}</p>
		</div>
	)
}

function StatusBadge({ status }: { status: number }) {
	const variant = status === 202 ? 'pending' : status >= 400 ? 'destructive' : 'success'

	return <Badge variant={variant}>HTTP {status}</Badge>
}

function createIdempotencyKey() {
	return `payment-${crypto.randomUUID().slice(0, 8)}`
}

function formatJson(value: unknown) {
	return JSON.stringify(value, null, 2)
}

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'medium',
	}).format(new Date(value))
}

function validateForm(form: PaymentFormState) {
	if (!form.idempotencyKey.trim()) {
		return 'Idempotency key is required.'
	}

	if (!form.customerId.trim()) {
		return 'Customer ID is required.'
	}

	const amount = Number(form.amount)
	if (!Number.isFinite(amount) || amount <= 0) {
		return 'Amount must be a positive number.'
	}

	return null
}

async function sendPaymentRequest(
	idempotencyKey: string,
	payload: { amount: number; customerId: string },
) {
	const response = await fetch(`${apiUrl}/payments`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Idempotency-Key': idempotencyKey,
		},
		body: JSON.stringify(payload),
	})

	const body = await response.json().catch(() => ({}))

	return {
		body,
		requestId: response.headers.get('X-Request-Id'),
		status: response.status,
	}
}

function toAttemptRecord(
	label: string,
	idempotencyKey: string,
	payload: { amount: number; customerId: string },
	response: { body: unknown; requestId: string | null; status: number },
	createdAt: string,
): AttemptRecord {
	return {
		id: crypto.randomUUID(),
		label,
		requestPayload: payload,
		idempotencyKey,
		status: response.status,
		body: response.body,
		requestId: response.requestId,
		createdAt,
	}
}

function readErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message
	}

	return 'Unexpected error while contacting the backend.'
}
