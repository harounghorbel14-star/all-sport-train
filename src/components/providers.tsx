"use client";

import { MotionConfig } from "framer-motion";
import { createContext, useContext, type ReactNode } from "react";
import { fmt, getDictionary, type Dictionary } from "@/lib/i18n";
import { ToastProvider } from "./ui/overlay";

const I18nCtx = createContext<{ t: Dictionary; locale: string; units: "metric" | "imperial" }>({ t: getDictionary("en"), locale: "en", units: "metric" });

export function useI18n() {
  return useContext(I18nCtx);
}
export { fmt };

export function Providers({ children, locale, units, reducedMotion }: { children: ReactNode; locale: string; units: "metric" | "imperial"; reducedMotion: boolean }) {
  return (
    <I18nCtx.Provider value={{ t: getDictionary(locale), locale, units }}>
      <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
        <ToastProvider>{children}</ToastProvider>
      </MotionConfig>
    </I18nCtx.Provider>
  );
}
