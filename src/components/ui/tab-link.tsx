"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

const here = () => window.location.pathname + window.location.search;

/**
 * A tab that changes only the query string. In production, Next's client router occasionally
 * fetches such a navigation but never commits it on chart-heavy pages (seen on Progress and the
 * sport hubs; root cause not found, still present on the latest Next 15 patch). If nothing has
 * happened shortly after a click, fall back to a normal page load so the tab always responds.
 */
export function TabLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const target = new URL(href, window.location.href);
        if (target.pathname + target.search === here()) return;
        const from = here();
        // Deliberately not cancelled on unmount: a stalled navigation can remount the tabs.
        // Only fires if the URL is still the one we clicked from, so later navigations win.
        setTimeout(() => {
          if (here() === from) window.location.assign(target.toString());
        }, 1500);
      }}
    />
  );
}
