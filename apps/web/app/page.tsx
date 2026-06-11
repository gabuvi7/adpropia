import { FinalCta, LandingHero, ProcessSection, ProofSection, PublicHeader, type LandingCta } from "@/components/landing/public-landing";

const cta: LandingCta = { href: "/auth/login", label: "Ingresar al panel" };

export default function LandingPage() {
  return (
    <>
      <PublicHeader cta={cta} />
      <main id="contenido" tabIndex={-1} className="scroll-mt-24">
        <LandingHero cta={cta} />
        <ProofSection />
        <ProcessSection />
      </main>
      <FinalCta cta={cta} />
    </>
  );
}
