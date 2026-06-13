import {
  publicPricingAddOns,
  publicPricingFaq,
  publicPricingPlans,
  publicPricingTerms,
  publicPricingWhatsAppUseCases,
} from "@adpropia/shared";
import type { PublicPricingPlan } from "@adpropia/shared";
import type { Route } from "next";
import Link from "next/link";

const requestAccessHref = "/request-access" as const;
const pricingPlans: readonly PublicPricingPlan[] = publicPricingPlans;

const sectionEyebrowClass = "text-sm font-semibold uppercase tracking-[0.28em] text-[#0355e8]";
const sectionTitleClass = "landing-balance mt-4 text-4xl font-semibold tracking-[-0.055em] text-[#0b1738]";

const planPresentation = {
  INICIAL: {
    eyebrow: "Casa y primeras unidades",
    fit: "Para empezar con una base ordenada de alquileres, cobros y contratos.",
    outcome: "Orden operativo sin sumar complejidad.",
    illustration: "house",
  },
  PROFESIONAL: {
    eyebrow: "Edificio en crecimiento",
    fit: "Para equipos que coordinan más unidades, usuarios y tareas repetidas.",
    outcome: "Reportes, liquidaciones y automatismos con mejor control.",
    illustration: "building",
  },
  OPERATIVO: {
    eyebrow: "Cartera operativa",
    fit: "Para operaciones con mayor volumen y seguimiento diario más exigente.",
    outcome: "Más trazabilidad para revisar reportes, auditoría y recordatorios.",
    illustration: "portfolio",
  },
  A_MEDIDA: {
    eyebrow: "Operación extendida",
    fit: "Para equipos que superan los límites públicos o necesitan condiciones específicas.",
    outcome: "Alcance definido según volumen y forma de trabajo.",
    illustration: "network",
  },
} as const satisfies Record<PublicPricingPlan["id"], { eyebrow: string; fit: string; outcome: string; illustration: "house" | "building" | "portfolio" | "network" }>;

function PricingCta({ label = "Solicitar acceso" }: Readonly<{ label?: string }>) {
  return (
    <Link
      href={requestAccessHref as Route}
      className="landing-focus inline-flex min-h-12 cursor-pointer items-center justify-center bg-[#0355e8] px-6 text-sm font-semibold text-white shadow-lg shadow-[#0355e8]/20 transition-colors duration-200 hover:bg-[#1472fa]"
    >
      {label}
    </Link>
  );
}

function PlanIllustration({ type }: Readonly<{ type: (typeof planPresentation)[PublicPricingPlan["id"]]["illustration"] }>) {
  const columnsByType = {
    house: [18, 30, 12],
    building: [34, 48, 28],
    portfolio: [44, 30, 54],
    network: [24, 40, 56],
  }[type];

  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center text-[#0355e8]" aria-hidden="true">
      <svg className="h-12 w-12" viewBox="0 0 80 80" fill="none">
        <path d="M8 68h64" stroke="#0b1738" strokeWidth="4" strokeLinecap="round" opacity="0.18" />
        <path d="M10 39 25 26l15 13v27H10V39Z" fill="#eef6ff" stroke="currentColor" strokeWidth="3" />
        <path d="M20 66V51h10v15" fill="#ffffff" stroke="currentColor" strokeWidth="3" />
        {columnsByType.map((height, index) => {
          const x = 45 + index * 9;
          const y = 66 - height;

          return <rect key={`${type}-${x}`} x={x} y={y} width="7" height={height} fill={index === 1 ? "#0355e8" : "#1472fa"} opacity={index === 0 ? 0.72 : 1} />;
        })}
        {type === "network" ? <path d="M48 22h18M57 13v36" stroke="#0b1738" strokeWidth="3" strokeLinecap="round" opacity="0.38" /> : null}
      </svg>
    </div>
  );
}

function CheckIcon() {
  return (
    <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[#0355e8]" aria-hidden="true">
      <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
        <path d="M2.2 6.2 4.8 8.8 9.8 3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function formatArgentinePesoCents(value: number) {
  return `ARS ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value / 100)}`;
}

function getPromoMonthlyPriceLabel(plan: PublicPricingPlan) {
  if (!plan.promo?.discountedPriceCents) return undefined;

  return `${formatArgentinePesoCents(plan.promo.discountedPriceCents)}/mes`;
}

function PlanFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-sm text-[#0b1738]/62">{label}</dt>
      <dd className="text-sm font-semibold text-[#0b1738]">{value}</dd>
    </div>
  );
}

function PriceBlock({ plan, promoMonthlyPriceLabel }: Readonly<{ plan: PublicPricingPlan; promoMonthlyPriceLabel: string | undefined }>) {
  if (!promoMonthlyPriceLabel) {
    return (
      <div>
        <p className="text-4xl font-semibold tracking-[-0.065em] text-[#0b1738] @[22rem]:text-5xl">{plan.monthlyPriceLabel}</p>
        <p className="mt-2 text-sm leading-6 text-[#0b1738]/62">Condiciones definidas según volumen.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-4xl font-semibold tracking-[-0.065em] text-[#0b1738] @[22rem]:text-5xl">{promoMonthlyPriceLabel}</p>
      <p className="mt-2 text-sm leading-6 text-[#0b1738]/68">
        Primeros {plan.promo?.durationMonths} meses. <span className="font-semibold text-[#0b1738]">Luego {plan.monthlyPriceLabel}</span>
      </p>
    </div>
  );
}

function PlanCard({ plan }: Readonly<{ plan: PublicPricingPlan }>) {
  const presentation = planPresentation[plan.id];
  const isPopular = plan.id === "PROFESIONAL";
  const promoMonthlyPriceLabel = getPromoMonthlyPriceLabel(plan);
  const operationalBenefits = plan.thresholds ? plan.benefits.slice(2) : plan.benefits;
  const unitsValue = plan.thresholds ? `Hasta ${plan.thresholds.maxRentalAdministrationUnits}` : "Más de 500";
  const usersValue = plan.thresholds ? `Hasta ${plan.thresholds.maxUsers}` : "A definir";

  return (
    <article className={`relative flex h-full flex-col overflow-hidden border transition-[border-color,box-shadow,background-color] duration-200 [container-type:inline-size] hover:border-[#0355e8]/45 hover:shadow-xl hover:shadow-[#0355e8]/10 ${isPopular ? "border-[#0355e8]/35 bg-[#f5f9ff] shadow-lg shadow-[#0355e8]/10" : "border-[#0b1738]/10 bg-white shadow-sm shadow-[#0355e8]/5"}`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${isPopular ? "bg-[#0355e8]" : "bg-[#1472fa]/25"}`} />
      <div className="flex flex-1 flex-col p-6 pt-7 @[34rem]:p-7 @[34rem]:pt-8">
        <div className="flex items-start gap-3">
          <PlanIllustration type={presentation.illustration} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[#0355e8]">{presentation.eyebrow}</p>
              {isPopular ? (
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#0355e8] shadow-sm shadow-[#0355e8]/10">
                  Recomendado
                </span>
              ) : null}
            </div>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#0b1738]">{plan.label}</h3>
          </div>
        </div>

        <div className="mt-7">
          <PriceBlock plan={plan} promoMonthlyPriceLabel={promoMonthlyPriceLabel} />
        </div>

        <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-[#0b1738]/8 py-4">
          <PlanFact label="Unidades" value={unitsValue} />
          <PlanFact label="Usuarios" value={usersValue} />
        </dl>

        <p className="landing-pretty mt-5 text-sm leading-6 text-[#0b1738]/76">
          {presentation.fit} <span className="font-semibold text-[#0b1738]">{presentation.outcome}</span>
        </p>

        <div className="mt-6 flex-1">
          <p className="text-sm font-semibold text-[#0b1738]">Incluye</p>
          <ul className="mt-3 space-y-2.5 text-sm leading-6 text-[#0b1738]/78">
            {operationalBenefits.map((benefit) => (
              <li key={benefit} className="flex gap-2.5">
                <CheckIcon />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href={requestAccessHref as Route}
          className={`landing-focus mt-7 inline-flex min-h-12 w-full cursor-pointer items-center justify-center px-5 text-sm font-semibold transition-colors duration-200 ${isPopular ? "bg-[#0355e8] text-white shadow-lg shadow-[#0355e8]/20 hover:bg-[#1472fa]" : "border border-[#0355e8]/45 bg-white text-[#0355e8] hover:border-[#0355e8] hover:bg-[#eef6ff]"}`}
        >
          {plan.id === "A_MEDIDA" ? "Consultar" : "Solicitar acceso"}
        </Link>
      </div>
    </article>
  );
}

function HeroSection() {
  return (
    <section aria-labelledby="pricing-title" className="overflow-hidden bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_58%,#ffffff_100%)] px-6 py-16 text-[#0b1738] md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_0.72fr] md:items-center">
        <div>
          <p className={sectionEyebrowClass}>Precios públicos</p>
          <h1 id="pricing-title" className="landing-balance mt-5 max-w-4xl text-5xl font-semibold leading-[0.92] tracking-[-0.075em] sm:text-7xl">
            Precios claros para ordenar tu operación inmobiliaria
          </h1>
          <p className="landing-pretty mt-7 max-w-2xl text-xl leading-8 text-[#0b1738]/78">
            Elegí una referencia mensual, compará la alternativa anual y sumá sólo los adicionales que correspondan a tu operación.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <PricingCta />
            <a className="landing-focus inline-flex min-h-12 items-center px-1 text-sm font-semibold text-[#0355e8] transition-colors duration-200 hover:text-[#1472fa]" href="#planes">
              Ver planes
            </a>
          </div>
        </div>
        <aside className="border border-[#0355e8]/16 bg-white/82 p-5 shadow-sm shadow-[#0355e8]/8" aria-label="Resumen comercial">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0355e8]">Reglas simples</p>
          <dl className="mt-5 grid gap-4 text-[#0b1738] sm:grid-cols-2 md:grid-cols-1">
            <div className="border-l border-[#0355e8]/28 pl-4">
              <dt className="text-2xl font-semibold tracking-[-0.05em]">20%</dt>
              <dd className="mt-1 text-sm leading-6 text-[#0b1738]/72">menos los primeros 3 meses en modalidad mensual.</dd>
            </div>
            <div className="border-l border-[#0355e8]/28 pl-4">
              <dt className="text-2xl font-semibold tracking-[-0.05em]">15%</dt>
              <dd className="mt-1 text-sm leading-6 text-[#0b1738]/72">de descuento anual con precio congelado por 12 meses.</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

function PlansSection() {
  return (
    <section id="planes" aria-labelledby="plans-title" className="scroll-mt-24 bg-white px-6 py-20 text-[#0b1738]">
      <div className="mx-auto max-w-6xl">
        <p className={sectionEyebrowClass}>Planes mensuales</p>
        <h2 id="plans-title" className={`${sectionTitleClass} max-w-3xl`}>Una base según unidades administradas y usuarios</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {pricingPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DiscountSection() {
  return (
    <section aria-labelledby="discounts-title" className="bg-[#f7fbff] px-6 py-20 text-[#0b1738]">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[0.75fr_1.25fr] md:items-start">
        <div>
          <p className={sectionEyebrowClass}>Mensual o anual</p>
          <h2 id="discounts-title" className={sectionTitleClass}>Cómo se aplican los descuentos</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="border border-[#0b1738]/10 bg-white p-6 shadow-sm shadow-[#0355e8]/5">
            <h3 className="text-2xl font-semibold tracking-[-0.04em]">Mensual</h3>
            <p className="mt-4 leading-7 text-[#0b1738]/76">
              {publicPricingTerms.monthlyPromo.percentOff}% menos los primeros {publicPricingTerms.monthlyPromo.durationMonths} meses, sólo para planes con precio mensual fijo.
            </p>
          </article>
          <article className="border border-[#0b1738]/10 bg-white p-6 shadow-sm shadow-[#0355e8]/5">
            <h3 className="text-2xl font-semibold tracking-[-0.04em]">Anual</h3>
            <p className="mt-4 leading-7 text-[#0b1738]/76">
              {publicPricingTerms.annual.percentOff}% de descuento y precio congelado por {publicPricingTerms.annual.priceFreezeMonths} meses.
            </p>
          </article>
          <p className="border border-[#0355e8]/18 bg-[#eef6ff] p-5 font-semibold leading-7 text-[#0b1738] md:col-span-2">
            {publicPricingTerms.discountCompatibilityNote}
          </p>
        </div>
      </div>
    </section>
  );
}

function AddOnsSection() {
  return (
    <section aria-labelledby="addons-title" className="bg-white px-6 py-20 text-[#0b1738]">
      <div className="mx-auto max-w-6xl">
        <p className={sectionEyebrowClass}>Adicionales separados</p>
        <h2 id="addons-title" className={`${sectionTitleClass} max-w-3xl`}>Sumá venta o WhatsApp operativo sólo si lo necesitás</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <article className="border border-[#0b1738]/10 bg-white p-6 shadow-sm shadow-[#0355e8]/5">
            <div className="h-1 w-14 bg-[#1472fa]/35" aria-hidden="true" />
            <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">{publicPricingAddOns.saleUnits.label}</h3>
            <p className="mt-5 text-lg font-semibold">gratis los primeros {publicPricingAddOns.saleUnits.freeMonths} meses</p>
            <p className="mt-2 leading-7 text-[#0b1738]/78">Luego {publicPricingAddOns.saleUnits.monthlyPricePerUnitLabel}. {publicPricingAddOns.saleUnits.description}</p>
          </article>
          <article className="border border-[#0b1738]/10 bg-white p-6 shadow-sm shadow-[#0355e8]/5">
            <div className="h-1 w-14 bg-[#1472fa]/35" aria-hidden="true" />
            <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">{publicPricingAddOns.whatsappOperations.label}</h3>
            <p className="mt-5 text-lg font-semibold">gratis los primeros {publicPricingAddOns.whatsappOperations.freeMonths} meses</p>
            <p className="mt-2 leading-7 text-[#0b1738]/78">Luego {publicPricingAddOns.whatsappOperations.monthlyPriceLabel} para recordatorios operativos.</p>
            <ul className="mt-5 grid gap-2 border-t border-[#0b1738]/8 pt-5 text-sm font-semibold text-[#0b1738]">
              {publicPricingWhatsAppUseCases.map((useCase) => (
                <li key={useCase} className="flex gap-2.5"><CheckIcon /><span>{useCase}</span></li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section aria-labelledby="comparison-title" className="bg-[#eef6ff] px-6 py-20 text-[#0b1738]">
      <div className="mx-auto max-w-6xl">
        <p className={sectionEyebrowClass}>Comparativa breve</p>
        <h2 id="comparison-title" className={`${sectionTitleClass} max-w-3xl`}>Qué mirar antes de pedir acceso</h2>
        <div className="mt-12 overflow-x-auto border border-[#0b1738]/10 bg-white shadow-sm shadow-[#0355e8]/5">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <caption className="sr-only">Comparación de planes por unidades, usuarios y operación recomendada</caption>
            <thead className="border-b border-[#0b1738]/10 text-[#0355e8]">
              <tr>
                <th scope="col" className="px-5 py-4 font-semibold">Plan</th>
                <th scope="col" className="px-5 py-4 font-semibold">Unidades base</th>
                <th scope="col" className="px-5 py-4 font-semibold">Usuarios</th>
                <th scope="col" className="px-5 py-4 font-semibold">Mejor para</th>
              </tr>
            </thead>
            <tbody>
              {pricingPlans.map((plan) => (
                <tr key={plan.id} className="border-b border-[#0b1738]/8 last:border-b-0">
                  <th scope="row" className="px-5 py-4 text-base font-semibold">{plan.label}</th>
                  <td className="px-5 py-4 text-[#0b1738]/76">{plan.thresholds ? `Hasta ${plan.thresholds.maxRentalAdministrationUnits}` : "Más de 500"}</td>
                  <td className="px-5 py-4 text-[#0b1738]/76">{plan.thresholds ? `Hasta ${plan.thresholds.maxUsers}` : "A definir"}</td>
                  <td className="px-5 py-4 leading-6 text-[#0b1738]/76">{plan.benefits[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section aria-labelledby="faq-title" className="bg-white px-6 py-20 text-[#0b1738]">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className={sectionEyebrowClass}>FAQ</p>
          <h2 id="faq-title" className={sectionTitleClass}>Preguntas frecuentes</h2>
        </div>
        <div className="divide-y divide-[#0b1738]/10 border-y border-[#0b1738]/10">
          {publicPricingFaq.map((item) => (
            <details key={item.question} className="group py-6">
              <summary className="landing-focus cursor-pointer list-none text-lg font-semibold tracking-[-0.03em] text-[#0b1738]">
                {item.question}
              </summary>
              <p className="landing-pretty mt-3 leading-7 text-[#0b1738]/76">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section aria-labelledby="pricing-final-title" className="bg-[#0b1738] px-6 py-16 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b8dcff]">Siguiente paso</p>
          <h2 id="pricing-final-title" className="landing-balance mt-4 text-4xl font-semibold tracking-[-0.055em]">Pedí acceso con una referencia concreta</h2>
          <p className="landing-pretty mt-4 max-w-2xl leading-7 text-white/78">El formulario mantiene su rol de cotizador e intake: no hay checkout online ni alta automática.</p>
        </div>
        <PricingCta />
      </div>
    </section>
  );
}

export function PublicPricing() {
  return (
    <>
      <HeroSection />
      <PlansSection />
      <DiscountSection />
      <AddOnsSection />
      <ComparisonSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
