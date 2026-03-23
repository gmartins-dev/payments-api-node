import { Button } from '../../../components/ui/button'
import { GuideCard, Metric } from './shared'

interface HeroSectionProps {
	apiDocsUrl: string
	apiTarget: string
	heroUpdatedAt: string
	latestOutcome: string
	latestResponseTime: string
}

export function HeroSection({
	apiDocsUrl,
	apiTarget,
	heroUpdatedAt,
	latestOutcome,
	latestResponseTime,
}: HeroSectionProps) {
	return (
		<section className="reveal rounded-[36px] border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(44,52,55,0.28),rgba(13,18,28,0.94))] p-6 shadow-[0_30px_120px_rgba(16,24,40,0.32)] backdrop-blur-xl sm:p-8">
			<div className="flex flex-col gap-8">
				<div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
					<div className="max-w-3xl space-y-4">
						<p className="text-xs font-semibold uppercase tracking-[0.38em] text-[var(--color-accent)]">
							Demo de Idempotência em Pagamentos
						</p>
						<h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
							Uma chave, um resultado persistido. Sem processamento duplicado.
						</h1>
						<p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
							Esta interface mostra quando a API processa de verdade, quando apenas devolve uma
							resposta já salva e como duas chamadas paralelas convergem para o mesmo desfecho.
						</p>
					</div>

					<div className="flex w-full max-w-3xl flex-col gap-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-400">
								Observe o comportamento da API sem precisar abrir o backend.
							</div>
							<Button asChild size="sm" variant="outline">
								<a href={apiDocsUrl} rel="noreferrer" target="_blank">
									Swagger
								</a>
							</Button>
						</div>

						<div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
							<Metric label="API alvo" value={apiTarget} />
							<Metric label="Último resultado" value={latestOutcome} />
							<Metric label="Tempo da resposta" value={latestResponseTime} />
							<Metric label="Atualizado" value={heroUpdatedAt} />
						</div>
					</div>
				</div>

				<div className="grid gap-3 lg:grid-cols-3">
					<GuideCard
						description="A primeira chamada executa o processamento e salva a resposta final."
						step="1"
						title="Crie um pagamento"
					/>
					<GuideCard
						description="Repita a mesma chave para provar que o retorno é reutilizado, não recalculado."
						step="2"
						title="Repita a mesma requisição"
					/>
					<GuideCard
						description="Dispare duas chamadas em paralelo para ver um único resultado compartilhado."
						step="3"
						title="Compare concorrência"
					/>
				</div>
			</div>
		</section>
	)
}
