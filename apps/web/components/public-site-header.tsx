import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import logo from "../logos/logo.png";

type PublicSiteNavAnchorItem = Readonly<{
  kind: "anchor";
  href: `#${string}`;
  label: string;
}>;

type PublicSiteNavRouteItem = Readonly<{
  kind: "route";
  href: Route;
  label: string;
  emphasis?: boolean;
}>;

export type PublicSiteNavItem = PublicSiteNavAnchorItem | PublicSiteNavRouteItem;

export const PUBLIC_HOME_NAV_ITEMS = [
  { kind: "anchor", href: "#control", label: "Control" },
  { kind: "anchor", href: "#proceso", label: "Proceso" },
  { kind: "route", href: "/pricing" as Route, label: "Ver precios" },
  { kind: "route", href: "/auth/login" as Route, label: "Ingresar al panel", emphasis: true },
] satisfies readonly PublicSiteNavItem[];

export const PUBLIC_REQUEST_ACCESS_NAV_ITEMS = [
  { kind: "route", href: "/pricing" as Route, label: "Ver precios" },
  { kind: "route", href: "/auth/login" as Route, label: "Ingresar al panel", emphasis: true },
] satisfies readonly PublicSiteNavItem[];

export const PUBLIC_PRICING_NAV_ITEMS = [
  { kind: "anchor", href: "#planes", label: "Planes" },
  { kind: "route", href: "/auth/login" as Route, label: "Ingresar al panel", emphasis: true },
] satisfies readonly PublicSiteNavItem[];

export type PublicSiteNavProps = Readonly<{
  ariaLabel?: string;
  items: readonly PublicSiteNavItem[];
}>;

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

export function PublicSiteNav({ ariaLabel = "Navegación principal", items }: PublicSiteNavProps) {
  return (
    <nav aria-label={ariaLabel} className="hidden items-center gap-7 text-sm font-semibold text-[#0b1738] sm:flex">
      {items.map((item) => {
        const className = item.kind === "route" && item.emphasis
          ? "landing-focus inline-flex min-h-11 items-center text-[#0355e8] transition-colors duration-200 hover:text-[#1472fa]"
          : "landing-focus inline-flex min-h-11 items-center transition-colors duration-200 hover:text-[#0355e8]";

        if (item.kind === "anchor") {
          return (
            <a key={`${item.href}:${item.label}`} className={className} href={item.href}>
              {item.label}
            </a>
          );
        }

        return (
          <Link key={`${item.href}:${item.label}`} className={className} href={item.href}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
