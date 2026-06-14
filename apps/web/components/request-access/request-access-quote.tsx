import {
  getFixedPlanDiscountedPriceCents,
  publicPricingTerms,
  recommendAccessPlan,
  type AccessPlanPromoMetadata,
} from "@adpropia/shared";

export function LiveQuoteBand({
  recommendation,
}: Readonly<{ recommendation: ReturnType<typeof recommendAccessPlan> }>) {
  const promoPriceLabel = getPromoPriceLabel(recommendation.display.promo);
  const annualMonthlyPriceCents = getFixedPlanDiscountedPriceCents(
    recommendation.plan,
    "annual",
  );
  const annualMonthlyPriceLabel = annualMonthlyPriceCents
    ? `${formatArgentinePesoCents(annualMonthlyPriceCents)}/mes equiv.`
    : recommendation.display.monthlyPriceLabel;
  const annualTotalLabel = annualMonthlyPriceCents
    ? formatArgentinePesoCents(annualMonthlyPriceCents * 12)
    : undefined;

  return (
    <section
      aria-labelledby="recommendation-title"
      className="grid min-w-0 gap-6 border border-[#0355e8]/18 bg-[#f7fbff] p-5 text-[#0b1738] shadow-sm shadow-[#0355e8]/8 sm:p-6"
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-end">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#0355e8]">
            Cotización en vivo
          </p>
          <h2
            id="recommendation-title"
            className="mt-2 text-4xl font-semibold tracking-[-0.065em] text-[#0b1738]"
          >
            Plan {recommendation.label}
          </h2>
          <p className="landing-pretty mt-2 text-sm leading-6 text-[#0b1738]/75">
            Por {recommendation.rentalAdministrationUnits} unidades de
            alquiler/administración y {recommendation.users} usuarios.
          </p>
        </div>

        <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
          <PriceTerm
            label="Mensual"
            value={promoPriceLabel ?? recommendation.display.monthlyPriceLabel}
            note={
              promoPriceLabel
                ? `Primeros ${recommendation.display.promo?.durationMonths ?? publicPricingTerms.monthlyPromo.durationMonths} meses. Luego ${recommendation.display.monthlyPriceLabel}.`
                : "Requiere revisión comercial"
            }
            featured
          />
          <PriceTerm
            label="Anual"
            value={annualMonthlyPriceLabel}
            note={
              annualTotalLabel
                ? `Total anual ${annualTotalLabel}. 15% menos, precio congelado 12 meses y no acumulable con la promo mensual.`
                : "Condiciones anuales a revisar con el equipo."
            }
          />
        </dl>
      </div>

      <div className="grid min-w-0 gap-3 border-y border-[#0b1738]/8 py-4">
        <div className="grid min-w-0 gap-2 text-sm leading-6 text-[#0b1738]/76 md:grid-cols-3">
          <ReasonNote value={recommendation.whyThisPlan} />
          {recommendation.nextThresholdHint ? (
            <ReasonNote value={recommendation.nextThresholdHint} />
          ) : null}
          {recommendation.saleUnitsCapturedSeparately > 0 ? (
            <ReasonNote value={recommendation.saleUnitsNote} />
          ) : null}
        </div>
      </div>

      <section
        aria-labelledby="plan-inclusions-title"
        className="grid min-w-0 gap-3"
      >
        <div className="grid min-w-0 gap-1 sm:grid-cols-[auto_1fr] sm:items-baseline sm:gap-3">
          <h3
            id="plan-inclusions-title"
            className="text-sm font-semibold text-[#0b1738]"
          >
            Incluye
          </h3>
          <p className="landing-pretty text-xs font-medium leading-5 text-[#0b1738]/60">
            Beneficios incluidos en el plan recomendado.
          </p>
        </div>
        <ul className="grid min-w-0 gap-2.5 text-sm leading-6 text-[#0b1738]/78 sm:grid-cols-3">
          {recommendation.display.benefits.map((benefit) => (
            <li
              key={benefit}
              className="grid min-w-0 grid-cols-[auto_1fr] gap-2"
            >
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 rounded-full bg-[#1472fa]"
              />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function PriceTerm({
  label,
  value,
  note,
  featured = false,
}: Readonly<{
  label: string;
  value: string;
  note?: string;
  featured?: boolean;
}>) {
  return (
    <div
      className={`min-w-0 border px-4 py-4 ${featured ? "border-[#0355e8]/35 bg-white text-[#0b1738] shadow-sm shadow-[#0355e8]/8" : "border-[#0b1738]/10 bg-white/72 text-[#0b1738]"}`}
    >
      <dt className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#0355e8]">
        {label}
      </dt>
      <dd className="mt-2 min-w-0 break-words text-3xl font-semibold tracking-[-0.055em]">
        {value}
      </dd>
      {note ? (
        <dd className="mt-2 text-sm leading-6 text-[#0b1738]/65">
          {note}
        </dd>
      ) : null}
    </div>
  );
}

function ReasonNote({ value }: Readonly<{ value: string }>) {
  return (
    <p className="landing-pretty grid grid-cols-[auto_1fr] gap-2">
      <span
        aria-hidden="true"
        className="mt-2 size-1.5 rounded-full bg-[#1472fa]"
      />
      <span>{value}</span>
    </p>
  );
}

export function PlanPromo({
  promo,
  regularMonthlyPriceLabel,
}: Readonly<{
  promo: AccessPlanPromoMetadata | undefined;
  regularMonthlyPriceLabel?: string;
}>) {
  if (!promo) return null;

  const details = [
    promo.discountedPriceCents
      ? `Precio inicial: ${formatArgentinePesoCents(promo.discountedPriceCents)}/mes`
      : null,
    promo.durationMonths ? `durante ${promo.durationMonths} meses` : null,
  ].filter(Boolean);

  return (
    <section
      className="landing-pretty border border-[#0355e8]/25 bg-[#0355e8] p-3 text-sm leading-6 text-white shadow-lg shadow-[#0355e8]/15"
      aria-label="Promoción disponible"
    >
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/75">
        Promo primeros 3 meses
      </p>
      <p className="mt-1 text-xl font-semibold tracking-[-0.04em]">
        {promo.label}
      </p>
      {details.length > 0 ? (
        <p className="mt-1 text-white/85">{details.join(" · ")}</p>
      ) : null}
      {regularMonthlyPriceLabel ? (
        <p className="mt-1 text-white/85">Luego {regularMonthlyPriceLabel}</p>
      ) : null}
      {promo.note ? <p className="mt-1 text-white/75">{promo.note}</p> : null}
    </section>
  );
}

function getPromoPriceLabel(promo: AccessPlanPromoMetadata | undefined) {
  if (!promo?.discountedPriceCents) return undefined;

  return `${formatArgentinePesoCents(promo.discountedPriceCents)}/mes`;
}

function formatArgentinePesoCents(value: number) {
  return `ARS ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value / 100)}`;
}
