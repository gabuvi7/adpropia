import { FinalCta, LandingHero, ProcessSection, ProofSection, PublicHeader, type LandingCta } from "@/components/landing/public-landing";
import { auth0 } from "@/lib/auth0";

function resolveLandingCta(session: Awaited<ReturnType<typeof auth0.getSession>>): LandingCta {
  if (!session) return { href: "/auth/login", label: "Solicitar acceso" };

  const name = session.user.name ?? session.user.email ?? "Ya";
  return {
    href: "/dashboard",
    label: "Ir al panel",
    note: `${name}, ya tenés una sesión activa.`,
  };
}

export default async function LandingPage() {
  const session = await auth0.getSession();
  const cta = resolveLandingCta(session);

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
