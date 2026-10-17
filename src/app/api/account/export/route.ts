import { authedRoute } from "@/lib/server/api";
import { exportAccount } from "@/lib/services/account";

export const GET = authedRoute({}, async ({ user }) => {
  const data = await exportAccount(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="apex-fit-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
