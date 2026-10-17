import { configProblems } from "@/lib/server/env";

/** Shown instead of a crash when required server configuration is missing. Lists variable names only. */
export function SetupNotice({ children }: { children: React.ReactNode }) {
  const problems = configProblems();
  if (!problems.length) return <>{children}</>;
  return (
    <div role="alert" className="rounded-2xl border border-warn/40 bg-surface p-6 sm:p-8">
      <h1 className="num text-3xl font-bold uppercase">Server setup incomplete</h1>
      <p className="mt-2 text-sm text-muted">The app is running, but sign-in can&apos;t work until the server&apos;s environment variables are set. If you run this server, fix:</p>
      <ul className="mt-3 list-disc space-y-1 ps-5 font-mono text-xs">
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-subtle">Then redeploy. Details: README → Deployment. Health check: /api/health</p>
    </div>
  );
}
