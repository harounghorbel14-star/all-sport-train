import Link from "next/link";
import { Lock } from "lucide-react";
import { safeNext } from "@/lib/auth/redirect";
import { ButtonLink, Card } from "@/components/ui/primitives";

export const metadata = { title: "Account needed" };

export default async function AccountRequired({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, "");
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <Card className="p-6 text-center sm:p-8">
      <Lock className="mx-auto size-10 text-accent" />
      <h1 className="num mt-3 text-3xl font-bold uppercase">Create a free account for this</h1>
      <p className="mt-2 text-sm text-muted">
        Community, challenges, private photos and form-check uploads involve other people or private media, so they need a full account. Everything you&apos;ve done as a guest is kept when you sign up.
      </p>
      <div className="mt-6 grid gap-2">
        <ButtonLink href={`/register${q}`} size="lg">
          Create account
        </ButtonLink>
        <ButtonLink href={`/login${q}`} variant="secondary" size="lg">
          Log in
        </ButtonLink>
        <Link href="/today" className="mt-2 text-sm text-muted underline">
          Keep exploring as a guest
        </Link>
      </div>
    </Card>
  );
}
