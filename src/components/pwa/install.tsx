"use client";

import { useEffect, useState } from "react";
import { Check, Download, Share, Smartphone, SquarePlus } from "lucide-react";
import { detectPlatform, isStandalone, type InstallPlatform } from "@/lib/client/pwa";
import { Sheet } from "../ui/overlay";
import { cx } from "../ui/primitives";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Download for Android / iPhone". APEX FIT is a web app that installs to the home screen
 * (no app-store listing): Android/desktop Chrome get the native install prompt, iOS gets
 * the Share → Add to Home Screen steps, which is the only install route Apple allows for web apps.
 */
export function InstallApp({ className, compact }: { className?: string; compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [guide, setGuide] = useState<InstallPlatform | null>(null);

  useEffect(() => {
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install(target: InstallPlatform) {
    const here = detectPlatform();
    if (deferred && target !== "ios" && here !== "ios") {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    setGuide(target);
  }

  if (installed) {
    return (
      <p className={cx("inline-flex items-center gap-2 text-sm text-muted", className)}>
        <Check className="size-4 text-accent" /> APEX FIT is installed on this device.
      </p>
    );
  }

  const btn = "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold hover:border-accent";
  return (
    <div className={className}>
      <div className={cx("flex flex-wrap gap-2", compact && "gap-1.5")}>
        <button type="button" className={btn} onClick={() => install("android")} aria-label="Download for Android">
          <Smartphone className="size-4 text-accent" /> {compact ? "Android" : "Download for Android"}
        </button>
        <button type="button" className={btn} onClick={() => install("ios")} aria-label="Download for iPhone and iPad">
          <Download className="size-4 text-accent" /> {compact ? "iPhone / iPad" : "Download for iPhone"}
        </button>
      </div>
      {!compact && <p className="mt-1.5 text-xs text-subtle">Free, no app store needed: APEX FIT installs from your browser, gets its own icon and opens full-screen. Saved lessons and plans work offline.</p>}
      <Sheet open={guide !== null} onClose={() => setGuide(null)} title={guide === "ios" ? "Install on iPhone or iPad" : "Install on Android"}>
        {guide === "ios" ? (
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">1</span>
              <span>Open this page in <strong>Safari</strong> (other iOS browsers may not offer the option).</span>
            </li>
            <li className="flex gap-3">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">2</span>
              <span className="inline-flex flex-wrap items-center gap-1">
                Tap the <Share className="inline size-4" aria-label="Share" /> <strong>Share</strong> button.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">3</span>
              <span className="inline-flex flex-wrap items-center gap-1">
                Choose <SquarePlus className="inline size-4" aria-hidden /> <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
              </span>
            </li>
            <li className="text-xs text-subtle">APEX FIT then opens from its own icon, full-screen. There is no App Store version yet.</li>
          </ol>
        ) : (
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">1</span>
              <span>Open this page in <strong>Chrome</strong> (or Edge / Samsung Internet).</span>
            </li>
            <li className="flex gap-3">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">2</span>
              <span>Tap the <strong>⋮ menu</strong> and choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</span>
            </li>
            <li className="flex gap-3">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">3</span>
              <span>Confirm with <strong>Install</strong>. The icon appears with your other apps.</span>
            </li>
            <li className="text-xs text-subtle">If the button above opened this guide instead of an install prompt, your browser hasn&apos;t offered installation yet — use the menu option. There is no Play Store version yet.</li>
          </ol>
        )}
      </Sheet>
    </div>
  );
}
