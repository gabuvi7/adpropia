export type LandingCta = Readonly<{
  href: "/auth/login";
  label: string;
}>;

type CtaProps = Readonly<{ cta: LandingCta }>;

const proofPoints = [
  {
    title: "Cartera ubicada",
    text: "Propiedades, unidades, propietarios e inquilinos se leen como relaciones operativas, no como registros sueltos.",
  },
  {
    title: "Índices y ajustes",
    text: "IPC, ICL, UVA y esquemas fijos, manuales o personalizados se registran por contrato con vigencia, cálculo preparado y rastro para revisión.",
  },
  {
    title: "Caja explicable",
    text: "Pagos, caja y liquidaciones mantienen rastro para revisar decisiones sin depender de planillas paralelas.",
  },
] as const;

const operatingSignals = [
  ["Cartera", "128 unidades bajo lectura operativa"],
  ["Índices", "IPC, ICL, UVA y ajustes personalizados"],
  ["Caja", "3 desvíos listos para revisar"],
] as const;

const processSteps = [
  "Registrá reglas de contrato: índice aplicable, período de ajuste, vigencia y criterio fijo, manual o personalizado.",
  "Usá automatismos para detectar próximas actualizaciones, preparar ajustes y priorizar qué revisar.",
  "Confirmá el cambio con cálculo, fecha efectiva y evidencia trazable antes de comunicar o liquidar.",
] as const;

function CtaLink({ cta, variant = "primary" }: CtaProps & Readonly<{ variant?: "primary" | "secondary" }>) {
  const classes =
    variant === "primary"
      ? "landing-focus inline-flex min-h-12 items-center justify-center bg-[#0355e8] px-6 text-sm font-semibold text-white shadow-lg shadow-[#0355e8]/20 transition-colors duration-200 hover:bg-[#1472fa]"
      : "landing-focus inline-flex min-h-12 items-center justify-center bg-white px-6 text-sm font-semibold text-[#0355e8] shadow-lg shadow-[#0355e8]/20 transition-colors duration-200 hover:bg-[#1472fa] hover:text-white";

  return (
    <a href={cta.href} className={classes}>
      {cta.label}
    </a>
  );
}

export function PublicHeader({ cta }: CtaProps) {
  return (
    <header className="relative bg-white">
      <a href="#contenido" className="landing-focus sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-10 focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[#0355e8]">
        Saltar al contenido principal
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-6">
        <a href="/" className="landing-focus flex min-h-12 items-center gap-3" aria-label="AdPropIA inicio">
          <span className="size-10 border border-[#0b1738]/20 bg-[#0b1738] shadow-lg shadow-[#0355e8]/20" aria-hidden="true" />
          <span className="flex flex-col leading-tight">
            <strong className="text-base tracking-[-0.04em] text-[#0b1738]">AdPropIA</strong>
            <span className="text-xs font-medium text-[#0355e8]">Gestión inmobiliaria</span>
          </span>
        </a>
        <nav aria-label="Navegación principal" className="hidden items-center gap-7 text-sm font-semibold text-[#0b1738] sm:flex">
          <a className="landing-focus inline-flex min-h-11 items-center transition-colors duration-200 hover:text-[#0355e8]" href="#control">Control</a>
          <a className="landing-focus inline-flex min-h-11 items-center transition-colors duration-200 hover:text-[#0355e8]" href="#proceso">Proceso</a>
          <a className="landing-focus inline-flex min-h-11 items-center text-[#0355e8] transition-colors duration-200 hover:text-[#1472fa]" href={cta.href}>{cta.label}</a>
        </nav>
      </div>
    </header>
  );
}

export function LandingHero({ cta }: CtaProps) {
  return (
    <section aria-labelledby="landing-title" className="overflow-hidden bg-white">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-12 md:grid-cols-[0.95fr_1.05fr] md:pb-24 md:pt-20">
        <div className="max-w-3xl">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.32em] text-[#0355e8]">SaaS inmobiliario multi-cliente</p>
          <h1 id="landing-title" className="landing-balance text-5xl font-semibold leading-[0.92] tracking-[-0.075em] text-[#0b1738] sm:text-7xl">
            Control inmobiliario para operar cartera, contratos y caja
          </h1>
          <p className="landing-pretty mt-7 max-w-2xl text-xl leading-8 text-[#0b1738]">
            Centralizá propiedades, vencimientos, pagos y auditoría en una plataforma pensada para administraciones que necesitan trazabilidad sin ruido visual.
          </p>
          <p className="landing-pretty mt-6 max-w-2xl border-l-4 border-[#0355e8] bg-[#1472fa]/10 px-5 py-4 text-sm font-semibold leading-6 text-[#0b1738]">
            Automatismos operativos para detectar próximas actualizaciones, preparar ajustes por IPC, ICL, UVA o reglas propias, y dejar evidencia para revisar.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <CtaLink cta={cta} />
            <a className="landing-focus inline-flex min-h-12 items-center px-1 text-sm font-semibold text-[#0355e8] transition-colors duration-200 hover:text-[#1472fa]" href="#control">Ver cómo ordena la operación</a>
          </div>
        </div>
        <div className="relative bg-[#0b1738] p-4 text-white shadow-2xl shadow-[#0355e8]/25">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:3rem_3rem]" aria-hidden="true" />
          <div className="relative grid min-h-[34rem] grid-rows-[1fr_auto] gap-4 border border-white/20 p-5">
            <div className="grid grid-cols-6 grid-rows-5 gap-3">
              <span className="col-span-3 row-span-2 bg-white p-5 text-sm font-semibold uppercase tracking-[0.22em] text-[#0355e8]">Plano operativo</span>
              <span className="col-span-2 row-span-1 bg-[#1472fa]/80" aria-hidden="true" />
              <span className="col-span-1 row-span-3 bg-white/15" aria-hidden="true" />
              <span className="col-span-2 row-span-2 bg-white/10" aria-hidden="true" />
              <span className="col-span-3 row-span-1 bg-[#0355e8]" aria-hidden="true" />
              <span className="col-span-2 row-span-2 bg-white/20" aria-hidden="true" />
              <span className="col-span-4 row-span-1 bg-white/10" aria-hidden="true" />
            </div>
            <div className="grid gap-0 bg-white text-[#0b1738] md:grid-cols-3">
              {operatingSignals.map(([label, text]) => (
                <div key={label} className="border-b border-[#0b1738]/10 p-4 md:border-b-0 md:border-r md:last:border-r-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0355e8]">{label}</p>
                  <p className="landing-pretty mt-2 text-sm font-semibold leading-6">{text}</p>
                </div>
              ))}
            </div>
            <div className="relative mt-4 max-w-none bg-white p-4 text-[#0b1738] shadow-xl shadow-[#0355e8]/20 md:absolute md:bottom-44 md:right-6 md:mt-0 md:max-w-44 md:p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0355e8]">Control</p>
              <p className="landing-pretty mt-2 text-base font-semibold leading-6 tracking-[-0.04em]">Cartera, contratos y caja en una lectura.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProofSection() {
  return (
    <section id="control" aria-labelledby="proof-title" className="scroll-mt-24 bg-[#0b1738] py-20 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b8dcff]">Operación inmobiliaria real</p>
          <h2 id="proof-title" className="landing-balance mt-4 text-4xl font-semibold tracking-[-0.055em]">Del dato disperso al control operativo</h2>
        </div>
        <div className="grid gap-0 border-y border-white/20">
          {proofPoints.map((point) => (
            <article key={point.title} className="grid gap-4 border-b border-white/20 py-6 last:border-b-0 md:grid-cols-[12rem_1fr]">
              <h3 className="text-xl font-semibold tracking-[-0.035em]">{point.title}</h3>
              <p className="landing-pretty leading-7 text-white/80">{point.text}</p>
            </article>
          ))}
        </div>
        <div className="bg-white p-6 text-[#0b1738] md:col-start-2">
          <h3 className="text-xl font-semibold tracking-[-0.03em]">Decisiones con rastro</h3>
          <p className="landing-pretty mt-3 max-w-3xl leading-7">
            AdPropIA organiza señales críticas para que el equipo priorice trabajo, revise desvíos y sostenga ajustes explicables ante clientes y administración.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ProcessSection() {
  return (
    <section id="proceso" aria-labelledby="process-title" className="scroll-mt-24 bg-white py-20 text-[#0b1738]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <h2 id="process-title" className="landing-balance text-4xl font-semibold tracking-[-0.055em]">Una secuencia sobria para tomar control</h2>
          <p className="landing-pretty max-w-2xl text-lg leading-8">El foco no está en decorar la gestión: está en convertir datos inmobiliarios en una operación legible, auditable y preparada para crecer.</p>
        </div>
        <ol className="mt-10 grid gap-0 border-y border-[#0b1738]/15 md:grid-cols-3">
          {processSteps.map((step, index) => (
            <li key={step} className="border-b border-[#0b1738]/15 py-7 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0">
              <span className="text-sm font-bold text-[#0355e8]">0{index + 1}</span>
              <p className="landing-pretty mt-5 leading-7">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FinalCta({ cta }: CtaProps) {
  return (
    <footer aria-labelledby="final-cta-title" className="bg-white px-6 pb-8 pt-2 text-[#0b1738]">
      <div className="mx-auto grid max-w-6xl gap-8 border-t border-[#0b1738]/15 py-10 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-[#0355e8]">Control sin teatro visual</p>
          <h2 id="final-cta-title" className="landing-balance text-4xl font-semibold tracking-[-0.055em]">Ordená la operación antes de escalarla</h2>
          <p className="landing-pretty mt-4 max-w-2xl leading-7">AdPropIA prepara una base sólida para crecer sin mezclar clientes, datos ni responsabilidades.</p>
        </div>
        <CtaLink cta={cta} />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-[#0b1738]/10 pt-5 text-xs font-medium text-[#0b1738]/60 sm:flex-row sm:items-center sm:justify-between">
        <p>© AdPropIA</p>
        <p>Desarrollado por GU Solutions</p>
      </div>
    </footer>
  );
}
