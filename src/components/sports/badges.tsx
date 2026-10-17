import { ExternalLink, ShieldAlert, Users } from "lucide-react";
import type { Availability } from "@/lib/content/sports/types";
import { Badge } from "@/components/ui/primitives";

const AVAILABILITY_TONE: Record<Availability, "accent" | "info" | "warn"> = { full: "accent", basic: "info", external: "warn" };
const SHORT: Record<Availability, string> = { full: "Learning system", basic: "In development", external: "External instruction" };

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  return <Badge tone={AVAILABILITY_TONE[availability]}>{SHORT[availability]}</Badge>;
}

const VERIFICATION: Record<string, { label: string; tone: "success" | "info" | "warn" }> = {
  summary: { label: "Summary checked against source", tone: "success" },
  general: { label: "General overview — not yet verified against the current rulebook", tone: "info" },
  unverified: { label: "Unverified", tone: "warn" },
};
export function VerificationBadge({ verification }: { verification: string }) {
  const v = VERIFICATION[verification] ?? VERIFICATION.unverified;
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

const CONTACT: Record<string, string> = { light: "Light partner contact", controlled: "Controlled contact", full: "Full contact" };
export function DrillBadges({ contact, requiresSupervision, setting, minPlayers }: { contact: string; requiresSupervision: boolean; setting: string; minPlayers: number }) {
  return (
    <>
      <Badge>{setting === "solo" ? "Solo" : setting === "partner" ? "Partner" : `Team · ${minPlayers}+`}</Badge>
      {contact !== "none" && (
        <Badge tone="warn">
          <Users className="me-1 inline size-3" />
          {CONTACT[contact] ?? contact}
        </Badge>
      )}
      {requiresSupervision && (
        <Badge tone="danger">
          <ShieldAlert className="me-1 inline size-3" />
          Qualified coach required
        </Badge>
      )}
    </>
  );
}

export function SourceList({ sources }: { sources: { slug: string; title: string; publisher: string; url: string | null }[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-3 border-t border-line pt-2 text-xs text-muted">
      <p className="font-semibold">Sources</p>
      <ul className="mt-1 space-y-0.5">
        {sources.map((s) => (
          <li key={s.slug}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-accent">
                {s.title} <ExternalLink className="size-3" />
              </a>
            ) : (
              s.title
            )}{" "}
            — {s.publisher}
          </li>
        ))}
      </ul>
    </div>
  );
}
