import { requireUser } from "@/lib/auth/server";

/** Distraction-free layout for live training. */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <main id="main" className="min-h-dvh">
      {children}
    </main>
  );
}
