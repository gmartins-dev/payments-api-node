export function App() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">
            Payment Idempotency Challenge
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
            Initial frontend setup is running.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            This project uses React, Vite 7, and Tailwind CSS v4 as the initial frontend stack. The next step is
            wiring the payment form and the idempotency demo flow.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-sm text-slate-400">Frontend</p>
              <p className="mt-2 font-medium text-white">React 19 + Vite 7</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-sm text-slate-400">Styling</p>
              <p className="mt-2 font-medium text-white">Tailwind CSS v4</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-sm text-slate-400">Deploy target</p>
              <p className="mt-2 font-medium text-white">Vercel</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
