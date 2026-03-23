import { HeroSection } from './features/payment-demo/components/HeroSection'
import { HistorySection } from './features/payment-demo/components/HistorySection'
import { LiveMonitorSection } from './features/payment-demo/components/LiveMonitorSection'
import { TestLabCard } from './features/payment-demo/components/TestLabCard'
import { usePaymentDemoViewModel } from './features/payment-demo/hooks/usePaymentDemoViewModel'
import { formatDuration } from './features/payment-demo/model'
import { usePaymentDemo } from './features/payment-demo/usePaymentDemo'
import { formatStageLabel } from './features/payment-demo/utils/presentation'

const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export function App() {
	const paymentDemo = usePaymentDemo(apiUrl)
	const viewModel = usePaymentDemoViewModel({
		apiUrl,
		groupedAttempts: paymentDemo.groupedAttempts,
		latestAttempt: paymentDemo.latestAttempt,
		liveFlow: paymentDemo.liveFlow,
	})

	return (
		<main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_50%_-5%,_rgba(132,186,100,0.18),_transparent_28%),linear-gradient(180deg,_rgba(44,52,55,0.16),_transparent_38%),var(--color-page)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
			<div className="mx-auto flex max-w-6xl flex-col gap-6">
				<HeroSection
					apiDocsUrl={viewModel.apiDocsUrl}
					apiTarget={viewModel.apiTarget}
					heroUpdatedAt={viewModel.heroUpdatedAt}
					latestOutcome={formatStageLabel(viewModel.latestOutcome)}
					latestResponseTime={formatDuration(viewModel.latestResponseTime)}
				/>

				<TestLabCard
					errorMessage={paymentDemo.errorMessage}
					form={paymentDemo.form}
					isBusy={paymentDemo.isBusy}
					latestAttempt={paymentDemo.latestAttempt}
					liveFlow={paymentDemo.liveFlow}
					onConcurrentRequests={paymentDemo.handleConcurrentRequests}
					onCreatePayment={paymentDemo.handleCreatePayment}
					onRefreshIdempotencyKey={paymentDemo.refreshIdempotencyKey}
					onReplayRequest={paymentDemo.handleReplaySameRequest}
					onSetFormField={paymentDemo.setFormField}
					requestPayload={paymentDemo.requestPayload}
				/>

				<LiveMonitorSection
					latestAttempt={paymentDemo.latestAttempt}
					liveFlow={paymentDemo.liveFlow}
					requestCount={viewModel.requestCount}
					scenarios={paymentDemo.scenarios}
				/>

				<HistorySection groupedAttempts={paymentDemo.groupedAttempts} />
			</div>
		</main>
	)
}
