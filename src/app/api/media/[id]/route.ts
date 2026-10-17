import { authedRoute } from "@/lib/server/api";
import { deleteUpload, readUpload } from "@/lib/services/media";

/** Private media: served only to the owner, never cached publicly. */
export const GET = authedRoute({}, async ({ user, params }) => {
  const { media, data } = await readUpload(user.id, params.id);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": media.mimeType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = authedRoute({}, async ({ user, params }) => {
  await deleteUpload(user.id, params.id);
  return { ok: true };
});
