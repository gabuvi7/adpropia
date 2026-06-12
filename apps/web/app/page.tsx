import { FinalCta, LandingHero, ProcessSection, ProofSection, PublicHeader, type LandingCta } from "@/components/landing/public-landing";

const cta: LandingCta = { href: "/request-access", label: "Solicitar acceso" };

export default function LandingPage() {
  return (
    <>
      <PublicHeader />
      <main id="contenido" tabIndex={-1} className="scroll-mt-24">
        <LandingHero cta={cta} />
        <ProofSection />
        <ProcessSection />
      </main>
      <FinalCta cta={cta} />
    </>
  );
}
