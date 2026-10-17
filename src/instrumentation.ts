/** Runs once when the server starts: report misconfiguration loudly instead of failing on first request. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { configProblems } = await import("./lib/server/env");
  const problems = configProblems();
  if (problems.length) {
    console.error(`[apex-fit] Server configuration is incomplete — sign-in pages will not work until fixed:\n  - ${problems.join("\n  - ")}\n  See README → Deployment.`);
  }
}
