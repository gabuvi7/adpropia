import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdPropIA | Gestión inmobiliaria con control",
  description: "Centralizá propiedades, contratos, pagos y auditoría en una plataforma inmobiliaria multi-cliente.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
