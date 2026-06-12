import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import logo from "../logos/logo.png";

export type PublicSiteHeaderProps = Readonly<{
  eyebrow: string;
  children?: ReactNode;
}>;

export function PublicSiteHeader({ eyebrow, children }: PublicSiteHeaderProps) {
  return (
    <header className="relative border-b border-[#0b1738]/10 bg-white">
      <a href="#contenido" className="landing-focus sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-10 focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[#0355e8]">
        Saltar al contenido principal
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="landing-focus flex min-h-12 items-center gap-3" aria-label="AdPropIA inicio">
          <Image src={logo} alt="AdPropIA" width={150} height={53} priority className="h-11 w-auto" />
          <span className="hidden border-l border-[#0b1738]/15 pl-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0355e8] sm:inline">
            {eyebrow}
          </span>
        </Link>
        {children}
      </div>
    </header>
  );
}
