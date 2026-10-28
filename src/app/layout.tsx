import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control de Deuda y Gastos",
  description: "Registro de abonos y deuda total con TRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
