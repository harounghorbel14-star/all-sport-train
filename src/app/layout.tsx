import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { currentUser } from "@/lib/auth/server";
import { isRtl } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "APEX FIT — AI Fitness & Calisthenics", template: "%s · APEX FIT" },
  description: "Personalised calisthenics, strength, nutrition and recovery coaching. Useful from day one — no equipment, subscription or wearable required.",
  applicationName: "APEX FIT",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0c0d" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6f3" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const p = user?.profile;
  const locale = p?.locale ?? "en";
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} data-theme={p?.theme ?? "dark"} data-reduced-motion={p?.reducedMotion ? "true" : undefined} suppressHydrationWarning>
      <body className="antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
          Skip to content
        </a>
        <Providers locale={locale} units={(p?.units as "metric" | "imperial") ?? "metric"} reducedMotion={!!p?.reducedMotion}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
