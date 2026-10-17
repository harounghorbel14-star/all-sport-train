/**
 * Research jobs for cron / manual runs.
 *   npx tsx scripts/research.ts init-queue
 *   npx tsx scripts/research.ts import prisma/research/2026-10-17
 *   npx tsx scripts/research.ts check-sources            # weekly: detect changed official sources
 *   npx tsx scripts/research.ts run-next 5               # research the 5 highest-priority queued topics (needs ANTHROPIC_API_KEY)
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { checkSources, importResearch, initResearchQueue, runAiResearch } from "../src/lib/services/research";

const db = new PrismaClient();

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  switch (cmd) {
    case "init-queue":
      console.log(`Queued ${await initResearchQueue()} new research tasks.`);
      break;
    case "import": {
      if (!arg) throw new Error("Usage: import <directory of research JSON files>");
      for (const f of readdirSync(arg).filter((x) => x.endsWith(".json"))) {
        const r = await importResearch(JSON.parse(readFileSync(path.join(arg, f), "utf8")));
        console.log(f, JSON.stringify(r));
      }
      break;
    }
    case "check-sources":
      console.log(JSON.stringify(await checkSources({ delayMs: 1500 })));
      break;
    case "run-next": {
      const n = Math.min(20, Number(arg ?? 3));
      const tasks = await db.researchTask.findMany({ where: { status: "queued", kind: { in: ["research_topic", "knowledge_gap", "verify_rules"] } }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }], take: n });
      for (const t of tasks) console.log(t.topic, JSON.stringify(await runAiResearch(t.id)));
      break;
    }
    default:
      console.log("Commands: init-queue | import <dir> | check-sources | run-next [n]");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
