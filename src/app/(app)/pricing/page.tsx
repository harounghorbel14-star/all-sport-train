import { Check } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { paymentsConfigured, TIERS, tiersEnforced } from "@/lib/subscriptions";
import { Badge, Card, Notice, PageHeader } from "@/components/ui/primitives";
import { cx } from "@/lib/cx";

export const metadata = { title: "Plans & pricing" };

export default async function PricingPage() {
  const { user } = await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Plans" title="Free, Pro & Elite" subtitle="The free plan is a complete training app. Paid tiers add depth — they never lock away the basics." />
      {!paymentsConfigured() && (
        <Notice tone="info">
          Payments aren&apos;t set up on this server yet, so upgrades are unavailable and no checkout is shown. {tiersEnforced() ? "" : "Tier limits are currently not enforced — every feature is available to everyone."}
        </Notice>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <Card key={t.id} className={cx("flex flex-col", user.tier === t.id && "border-accent")}>
            <div className="flex items-center justify-between">
              <h2 className="num text-3xl font-bold uppercase">{t.name}</h2>
              {user.tier === t.id && <Badge tone="accent">Current</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">{t.tagline}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-accent" />{f}</li>
              ))}
            </ul>
            <button disabled className="mt-5 h-11 rounded-xl bg-surface-3 text-sm font-semibold text-muted">
              {user.tier === t.id ? "Your plan" : "Upgrade unavailable"}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
