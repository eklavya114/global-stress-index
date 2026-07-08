import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Earth Pulse — Civilization Stress Index",
  description: "Real-time global stress dashboard across conflict, food, and economic dimensions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="text-slate-100 antialiased" style={{ background: "#020408" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
